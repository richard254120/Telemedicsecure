/**
 * Resource store for the admin console.
 *
 * The generic fetch-on-demand / abort-on-unmount / partial-refresh engine now
 * lives in `dashboard-shell/store`; this file supplies only the admin endpoint
 * map and re-exports the types the panels already import from here.
 */
import { useCallback } from 'react';
import * as api from '../api';
import {
  useResourceStore,
  selectRows as selectRowsShared,
  type Reader,
  type ResourceState,
  type ResourceStatus,
} from '../../../../dashboard-shell/store';
import type { AdminUser, ChainVerificationReport } from '../types';

// Re-exported so existing `import { selectRows, ResourceState } from '../hooks/useAdminData'`
// call sites across the panels and modals keep compiling unchanged.
export type { ResourceState, ResourceStatus };
export const selectRows = selectRowsShared;

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

const READERS: Record<ResourceKey, Reader> = {
  stats: (h, s) => api.readSystemStats(h, s),
  users: (h, s) => api.readUsers(h, s),
  violations: (h, s) => api.readViolations(h, s),
  alerts: (h, s) => api.readAlerts(h, s),
  chain: (h, s) => api.readChainReport(h, s),
  prescriptions: (h, s) => api.readPrescriptionAudits(h, s),
  incidents: (h, s) => api.readIncidents(h, s),
  invitations: (h, s) => api.readInvitations(h, s),
  smsLogs: (h, s) => api.readSmsLogs(h, s),
  smsStatus: (_h, s) => api.readSmsStatus(s),
};

const KEYS = Object.keys(READERS) as ResourceKey[];

export interface AdminData {
  state: Record<ResourceKey, ResourceState>;
  ensure: (keys: ResourceKey[]) => void;
  refresh: (keys?: ResourceKey[]) => Promise<void>;
  /** Convenience for mutation handlers: refresh users + derived aggregates. */
  refreshWorkforce: () => Promise<void>;
  reset: () => void;
  isBusy: boolean;
  lastSyncedAt: number | null;
}

export function useAdminData(getAuthHeaders: () => Record<string, string>): AdminData {
  const base = useResourceStore<ResourceKey>(KEYS, READERS, getAuthHeaders);
  const refreshWorkforce = useCallback(() => base.refresh(['users', 'stats']), [base.refresh]);
  return { ...base, refreshWorkforce };
}

/* ------------------------------------------------------------------ *
 * Typed selectors — keep the `as` casts out of the view layer.
 * ------------------------------------------------------------------ */

export function selectUsers(data: AdminData): AdminUser[] {
  return selectRowsShared<AdminUser>(data.state.users);
}

export function selectChain(data: AdminData): ChainVerificationReport | null {
  return (data.state.chain.data as ChainVerificationReport | null) ?? null;
}
