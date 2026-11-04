/**
 * Resource store for the admin console.
 *
 * Replaces the old "fire all ten endpoints on mount and refire all ten after
 * every mutation" loader. Properties of this store:
 *
 *  - a resource is fetched the first time a mounted view asks for it, never
 *    before (the SMS ledger is not fetched while you are on Overview);
 *  - every request owns an AbortController that is cancelled on unmount, so
 *    a late response can never write into a dead tree;
 *  - failures are per-resource and retryable; one dead endpoint cannot blank
 *    the whole dashboard;
 *  - mutations refresh only the resources they actually invalidate.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import * as api from '../api';
import type { AdminUser, ChainVerificationReport } from '../types';

export type ResourceKey =
  | 'stats'
  | 'users'
  | 'violations'
  | 'alerts'
  | 'chain'
  | 'prescriptions'
  | 'incidents'
  | 'invitations'
  | 'smsLogs'
  | 'smsStatus';

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ResourceState<T = unknown> {
  status: ResourceStatus;
  data: T | null;
  error: string | null;
  fetchedAt: number | null;
}

type HeadersFactory = () => Record<string, string>;

interface ResourceDescriptor {
  read: (getAuthHeaders: HeadersFactory, signal: AbortSignal) => Promise<unknown>;
}

const DESCRIPTORS: Record<ResourceKey, ResourceDescriptor> = {
  stats: { read: (h, s) => api.readSystemStats(h, s) },
  users: { read: (h, s) => api.readUsers(h, s) },
  violations: { read: (h, s) => api.readViolations(h, s) },
  alerts: { read: (h, s) => api.readAlerts(h, s) },
  chain: { read: (h, s) => api.readChainReport(h, s) },
  prescriptions: { read: (h, s) => api.readPrescriptionAudits(h, s) },
  incidents: { read: (h, s) => api.readIncidents(h, s) },
  invitations: { read: (h, s) => api.readInvitations(h, s) },
  smsLogs: { read: (h, s) => api.readSmsLogs(h, s) },
  smsStatus: { read: (_h, s) => api.readSmsStatus(s) },
};

const EMPTY: ResourceState = { status: 'idle', data: null, error: null, fetchedAt: null };

type Action =
  | { type: 'start'; key: ResourceKey }
  | { type: 'success'; key: ResourceKey; data: unknown }
  | { type: 'error'; key: ResourceKey; error: string }
  | { type: 'reset'; key: ResourceKey };

function reducer(state: Record<ResourceKey, ResourceState>, action: Action): Record<ResourceKey, ResourceState> {
  const current = state[action.key];
  let next: ResourceState;

  switch (action.type) {
    case 'start':
      next = { ...current, status: 'loading', error: null };
      break;
    case 'success':
      next = { status: 'success', data: action.data, error: null, fetchedAt: Date.now() };
      break;
    case 'error':
      next = { ...current, status: 'error', error: action.error };
      break;
    case 'reset':
      // Cached PHI is dropped, but the failure reason is kept so a session gate
      // can still explain why the panel went blank.
      next = { status: 'idle', data: null, error: current.error, fetchedAt: null };
      break;
  }

  if (next === current) return state;
  return { ...state, [action.key]: next };
}

function initialState(): Record<ResourceKey, ResourceState> {
  return (Object.keys(DESCRIPTORS) as ResourceKey[]).reduce(
    (acc, key) => { acc[key] = EMPTY; return acc; },
    {} as Record<ResourceKey, ResourceState>,
  );
}

export interface AdminData {
  state: Record<ResourceKey, ResourceState>;
  /** Load resources that are not cached yet; safe to call on every render. */
  ensure: (keys: ResourceKey[]) => void;
  /** Force a network read for the given resources (default: everything cached). */
  refresh: (keys?: ResourceKey[]) => Promise<void>;
  /** Convenience for mutation handlers: refresh users + derived aggregates. */
  refreshWorkforce: () => Promise<void>;
  /** Drop every cached payload (used when the session stops being valid). */
  reset: () => void;
  isBusy: boolean;
  lastSyncedAt: number | null;
}

export function useAdminData(getAuthHeaders: HeadersFactory): AdminData {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  /* Keys whose last network read succeeded. This is deliberately *not* derived
   * from `state` through a ref written during render (that is not concurrent
   * safe): it is only touched from fetch completions and event handlers. */
  const warm = useRef<Set<ResourceKey>>(new Set());

  /* Every key some mounted view has asked for, warm or not. `refresh()` with no
   * arguments re-reads exactly this set, which is what keeps a failed panel
   * retryable from the global refresh button. */
  const requested = useRef<Set<ResourceKey>>(new Set());

  const inflight = useRef<Partial<Record<ResourceKey, AbortController>>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controllers = inflight.current;
    return () => {
      mounted.current = false;
      Object.values(controllers).forEach(c => c?.abort());
    };
  }, []);

  const load = useCallback(async (key: ResourceKey, force: boolean): Promise<void> => {
    // An identical request is already on the wire — or the cache is warm and
    // nobody asked for a revalidation. Either way, do not refetch.
    if (inflight.current[key]) return;
    if (!force && warm.current.has(key)) return;

    const controller = new AbortController();
    inflight.current[key] = controller;
    requested.current.add(key);
    dispatch({ type: 'start', key });

    try {
      const data = await DESCRIPTORS[key].read(getAuthHeaders, controller.signal);
      if (mounted.current && !controller.signal.aborted) {
        warm.current.add(key);
        dispatch({ type: 'success', key, data });
      }
    } catch (err) {
      // An abort is a deliberate cancellation, not a failure worth showing.
      if (api.isAbortError(err) || controller.signal.aborted) return;
      warm.current.delete(key);
      if (mounted.current) {
        dispatch({ type: 'error', key, error: api.errorMessage(err, 'Request failed') });
      }
    } finally {
      if (inflight.current[key] === controller) delete inflight.current[key];
    }
  }, [getAuthHeaders]);

  const ensure = useCallback((keys: ResourceKey[]) => {
    keys.forEach(key => { void load(key, false); });
  }, [load]);

  const refresh = useCallback(async (keys?: ResourceKey[]) => {
    const targets = keys ?? (Object.keys(DESCRIPTORS) as ResourceKey[])
      .filter(key => requested.current.has(key));
    await Promise.all(targets.map(key => load(key, true)));
  }, [load]);

  const refreshWorkforce = useCallback(
    () => refresh(['users', 'stats']),
    [refresh],
  );

  const reset = useCallback(() => {
    Object.values(inflight.current).forEach(controller => controller?.abort());
    inflight.current = {};
    warm.current.clear();
    (Object.keys(DESCRIPTORS) as ResourceKey[]).forEach(key => dispatch({ type: 'reset', key }));
  }, []);

  const isBusy = useMemo(
    () => Object.values(state).some(s => s.status === 'loading'),
    [state],
  );

  const lastSyncedAt = useMemo(() => {
    const stamps = Object.values(state).map(s => s.fetchedAt).filter(Boolean) as number[];
    return stamps.length ? Math.max(...stamps) : null;
  }, [state]);

  return { state, ensure, refresh, refreshWorkforce, reset, isBusy, lastSyncedAt };
}

/* ------------------------------------------------------------------ *
 * Typed selectors — keep the `as` casts out of the view layer.
 * ------------------------------------------------------------------ */

const NO_ROWS = Object.freeze([]) as never[];

/**
 * Rows of a list resource.
 *
 * Returns a referentially stable array: the frozen `NO_ROWS` singleton while the
 * resource is idle or empty, otherwise the payload held in reducer state. Writing
 * `resource.data ?? []` inside a component allocates a fresh array every render,
 * which quietly invalidates every `useMemo` and `React.memo` that lists it — the
 * exact cost this refactor was meant to remove.
 */
export function selectRows<T>(resource: ResourceState): T[] {
  return resource.data ? (resource.data as T[]) : NO_ROWS;
}

export function selectUsers(data: AdminData): AdminUser[] {
  return selectRows<AdminUser>(data.state.users);
}

export function selectChain(data: AdminData): ChainVerificationReport | null {
  return (data.state.chain.data as ChainVerificationReport | null) ?? null;
}
