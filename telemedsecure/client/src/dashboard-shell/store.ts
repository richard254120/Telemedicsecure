/**
 * Generic, per-resource data store shared by every dashboard.
 *
 * This is the pattern the admin console proved out, lifted so each station can
 * instantiate it with its own set of read functions:
 *
 *  - a resource is fetched the first time a mounted view asks for it, never
 *    before;
 *  - every request owns an AbortController cancelled on unmount, so a late
 *    response can never write into a dead tree;
 *  - failures are per-resource and retryable; one dead endpoint cannot blank
 *    the whole dashboard;
 *  - mutations refresh only the resources they actually invalidate.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { errorMessage, isAbortError, type HeadersFactory } from './transport';

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ResourceState<T = unknown> {
  status: ResourceStatus;
  data: T | null;
  error: string | null;
  fetchedAt: number | null;
}

/** Reads one resource. The abort signal must be forwarded to the transport. */
export type Reader = (getAuthHeaders: HeadersFactory, signal: AbortSignal) => Promise<unknown>;

export interface ResourceStore<K extends string> {
  state: Record<K, ResourceState>;
  /** Load resources that are not cached yet; safe to call on every render. */
  ensure: (keys: K[]) => void;
  /** Force a network read for the given resources (default: everything requested). */
  refresh: (keys?: K[]) => Promise<void>;
  /** Drop every cached payload (used when the session stops being valid). */
  reset: () => void;
  isBusy: boolean;
  lastSyncedAt: number | null;
}

type Action<K> =
  | { type: 'start'; key: K }
  | { type: 'success'; key: K; data: unknown }
  | { type: 'error'; key: K; error: string }
  | { type: 'reset'; key: K };

function reducer<K extends string>(state: Record<K, ResourceState>, action: Action<K>): Record<K, ResourceState> {
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

const EMPTY: ResourceState = { status: 'idle', data: null, error: null, fetchedAt: null };

export function useResourceStore<K extends string>(
  keys: K[],
  readers: Record<K, Reader>,
  getAuthHeaders: HeadersFactory,
): ResourceStore<K> {
  const [state, dispatch] = useReducer(
    reducer as (s: Record<K, ResourceState>, a: Action<K>) => Record<K, ResourceState>,
    keys.reduce((acc, key) => { acc[key] = EMPTY; return acc; }, {} as Record<K, ResourceState>),
  );

  /* Keys whose last network read succeeded. Deliberately *not* derived from
   * `state` through a ref written during render (not concurrent safe): it is
   * only touched from fetch completions and event handlers. */
  const warm = useRef<Set<K>>(new Set());

  /* Every key some mounted view has asked for, warm or not. `refresh()` with no
   * arguments re-reads exactly this set, which keeps a failed panel retryable
   * from the global refresh button. */
  const requested = useRef<Set<K>>(new Set());

  const inflight = useRef<Partial<Record<K, AbortController>>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controllers = Object.values(inflight.current) as (AbortController | undefined)[];
    return () => {
      mounted.current = false;
      controllers.forEach(c => c?.abort());
    };
  }, []);

  const load = useCallback(async (key: K, force: boolean): Promise<void> => {
    if (inflight.current[key]) return;
    if (!force && warm.current.has(key)) return;

    const controller = new AbortController();
    inflight.current[key] = controller;
    requested.current.add(key);
    dispatch({ type: 'start', key });

    try {
      const data = await readers[key](getAuthHeaders, controller.signal);
      if (mounted.current && !controller.signal.aborted) {
        warm.current.add(key);
        dispatch({ type: 'success', key, data });
      }
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) return;
      warm.current.delete(key);
      if (mounted.current) {
        dispatch({ type: 'error', key, error: errorMessage(err, 'Request failed') });
      }
    } finally {
      if (inflight.current[key] === controller) delete inflight.current[key];
    }
  }, [getAuthHeaders, readers]);

  const ensure = useCallback((targets: K[]) => {
    targets.forEach(key => { void load(key, false); });
  }, [load]);

  const refresh = useCallback(async (targets?: K[]) => {
    const list = targets ?? keys.filter(key => requested.current.has(key));
    await Promise.all(list.map(key => load(key, true)));
  }, [keys, load]);

  const reset = useCallback(() => {
    (Object.values(inflight.current) as (AbortController | undefined)[]).forEach(controller => controller?.abort());
    inflight.current = {};
    warm.current.clear();
    keys.forEach(key => dispatch({ type: 'reset', key }));
  }, [keys]);

  const isBusy = useMemo(
    () => (Object.values(state) as ResourceState[]).some(s => s.status === 'loading'),
    [state],
  );

  const lastSyncedAt = useMemo(() => {
    const stamps = (Object.values(state) as ResourceState[]).map(s => s.fetchedAt).filter(Boolean) as number[];
    return stamps.length ? Math.max(...stamps) : null;
  }, [state]);

  return { state, ensure, refresh, reset, isBusy, lastSyncedAt };
}

/* ------------------------------------------------------------------ *
 * Typed selectors — keep the `as` casts out of the view layer.
 * ------------------------------------------------------------------ */

const NO_ROWS = Object.freeze([]) as never[];

/**
 * Rows of a list resource. Returns a referentially stable array: the frozen
 * `NO_ROWS` singleton while the resource is idle or empty, otherwise the payload
 * held in reducer state. Writing `resource.data ?? []` in a component allocates a
 * fresh array every render, quietly invalidating every memo of lists it feeds.
 */
export function selectRows<T>(resource: ResourceState): T[] {
  return resource.data ? (resource.data as T[]) : NO_ROWS;
}
