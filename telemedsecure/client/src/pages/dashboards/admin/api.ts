/**
 * Typed transport for every endpoint the admin console consumes.
 *
 * Two rules the previous inline `fetch(...).then(r => r.ok ? r.json() : [])`
 * calls broke, and that this module enforces:
 *
 *  1. A non-2xx response is an *error*, never a silent empty array. An
 *     unreachable endpoint must not be renderable as "0 violations".
 *  2. A 401/403 broadcasts `telemed:auth-expired` so the session can be
 *     terminated instead of leaving a stale operator looking at a blank HUD.
 */
import { API_BASE } from '../../../config';
import type {
  AdminUser,
  ChainVerificationReport,
  ComplianceViolation,
  Incident,
  SecurityAlert,
  SmsLog,
  SmsStatus,
  StaffInvitation,
  Severity,
  SystemStats,
  VerificationStatus,
  PrescriptionAudit,
} from './types';
import type { UserRole } from '../../../context/AuthContext';

export const AUTH_EXPIRED_EVENT = 'telemed:auth-expired';

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(status: number, message: string, detail: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }

  /** True when the response means "your session is no longer valid". */
  get isAuthFailure() {
    return this.status === 401 || this.status === 403;
  }
}

type HeadersFactory = () => Record<string, string>;

/**
 * True for the rejection an AbortController produces. `fetch` rejects with a
 * DOMException (not an Error subclass every engine guarantees), so the name is
 * read structurally instead of via `err: any`.
 */
export function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

/** A message safe to show an operator, from a value of unknown shape. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function broadcastAuthExpired() {
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

async function parseError(res: Response, fallback: string): Promise<ApiError> {
  let detail: string | null = null;
  try {
    const body = await res.json();
    detail = (body && (body.error || body.message || body.details)) || null;
  } catch {
    detail = null;
  }
  if (res.status === 401 || res.status === 403) broadcastAuthExpired();
  return new ApiError(res.status, detail || `${fallback} (HTTP ${res.status})`, detail);
}

async function request<T>(
  getAuthHeaders: HeadersFactory,
  path: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...getAuthHeaders(),
      },
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(0, `${fallbackMessage}: network unreachable`);
  }

  if (!res.ok) throw await parseError(res, fallbackMessage);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(h: HeadersFactory, path: string, msg: string, signal?: AbortSignal) =>
  request<T>(h, path, { method: 'GET', signal }, msg);

const put = <T>(h: HeadersFactory, path: string, body: unknown, msg: string) =>
  request<T>(h, path, { method: 'PUT', body: JSON.stringify(body) }, msg);

const post = <T>(h: HeadersFactory, path: string, body: unknown, msg: string) =>
  request<T>(h, path, { method: 'POST', body: JSON.stringify(body) }, msg);

const del = <T>(h: HeadersFactory, path: string, msg: string) =>
  request<T>(h, path, { method: 'DELETE' }, msg);

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export const readUsers = (h: HeadersFactory, s?: AbortSignal) =>
  get<AdminUser[]>(h, '/admin/users', 'Could not load the workforce directory', s);

export const readSystemStats = (h: HeadersFactory, s?: AbortSignal) =>
  get<SystemStats>(h, '/admin/stats', 'Could not load platform statistics', s);

export const readViolations = (h: HeadersFactory, s?: AbortSignal) =>
  get<ComplianceViolation[]>(h, '/compliance/violations', 'Could not load compliance violations', s);

export const readAlerts = (h: HeadersFactory, s?: AbortSignal) =>
  get<SecurityAlert[]>(h, '/compliance/alerts', 'Could not load security alerts', s);

export const readChainReport = (h: HeadersFactory, s?: AbortSignal) =>
  get<ChainVerificationReport>(h, '/integrity/verify', 'Could not verify the audit chain', s);

export const readPrescriptionAudits = (h: HeadersFactory, s?: AbortSignal) =>
  get<PrescriptionAudit[]>(h, '/prescriptions/audit/all', 'Could not load the prescription audit registry', s);

export const readIncidents = (h: HeadersFactory, s?: AbortSignal) =>
  get<Incident[]>(h, '/investigation/incidents', 'Could not load incidents', s);

export const readInvitations = (h: HeadersFactory, s?: AbortSignal) =>
  get<StaffInvitation[]>(h, '/admin/invitations', 'Could not load staff invitations', s);

export const readSmsLogs = (h: HeadersFactory, s?: AbortSignal) =>
  get<SmsLog[]>(h, '/sms/logs', 'Could not load the SMS audit ledger', s);

/** Public endpoint — deliberately sent without credentials. */
export const readSmsStatus = async (s?: AbortSignal): Promise<SmsStatus> => {
  const res = await fetch(`${API_BASE}/sms/status`, { signal: s });
  if (!res.ok) throw new ApiError(res.status, 'Could not read the SMS gateway status');
  return res.json();
};

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

export const verifyCredentials = (h: HeadersFactory, userId: string, verificationStatus: VerificationStatus) =>
  put<{ message: string }>(h, `/admin/users/${userId}/verify-credentials`, { verificationStatus }, 'Credential decision failed');

export const changeUserRole = (h: HeadersFactory, userId: string, role: UserRole) =>
  put<{ message: string }>(h, `/admin/users/${userId}/role`, { role }, 'Role change failed');

export const setUserActive = (h: HeadersFactory, userId: string, isActive: boolean) =>
  put<{ message: string }>(h, `/admin/users/${userId}/status`, { isActive }, 'Status change failed');

export const resetUserTotp = (h: HeadersFactory, userId: string) =>
  post<{ message: string; secret: string; replacedExistingEnrolment: boolean }>(
    h, `/admin/users/${userId}/totp`, {}, '2FA reset failed',
  );

export const deleteUser = (h: HeadersFactory, userId: string) =>
  del<{ message: string }>(h, `/admin/users/${userId}`, 'Deletion failed');

export const batchDeleteUsers = (h: HeadersFactory, userIds: string[]) =>
  post<{ message: string; deletedCount: number }>(h, '/admin/users/batch-delete', { userIds }, 'Batch deletion failed');

export interface ProvisionInput {
  email: string;
  /**
   * Omitted when the operator lets the server mint the credential: the admin
   * endpoint generates an argon2-hashed temporary password if this is absent or
   * shorter than 8 characters.
   */
  password?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  medicalLicenseNo?: string;
  licenseJurisdiction?: string;
  specialty?: string;
}

export const provisionStaff = (h: HeadersFactory, input: ProvisionInput) =>
  post<{
    message: string;
    // Always present on 201: either the minted credential or the supplied one,
    // which is why the UI reads it from the response instead of the form.
    temporaryPassword: string;
    user: { email: string };
  }>(
    h, '/admin/users', input, 'Staff provisioning failed',
  );

export interface InvitationInput {
  email: string;
  role: UserRole;
  expiresInHours: number;
}

export const createInvitation = (h: HeadersFactory, input: InvitationInput) =>
  post<{ message: string; token: string; expiresInMinutes: number }>(
    h, '/admin/invitations', input, 'Invitation issuance failed',
  );

export const revokeInvitation = (h: HeadersFactory, invitationId: string) =>
  del<{ message: string }>(h, `/admin/invitations/${invitationId}`, 'Invitation revoke failed');

export const resolveViolation = (h: HeadersFactory, violationId: string, resolvedBy: string, note?: string) =>
  post<{ message: string }>(
    h, `/compliance/violations/${violationId}/resolve`, { resolvedBy, note }, 'Could not close the violation',
  );

export interface IncidentInput {
  alertId?: string;
  title: string;
  description: string;
  severity: Severity;
}

/** Escalate a security alert into a tracked forensic case. */
export const openIncident = (h: HeadersFactory, input: IncidentInput) =>
  post<{ id: string }>(h, '/investigation/incidents', input, 'Could not open the incident');

export const sendTestSms = (h: HeadersFactory, to: string, message: string) =>
  post<{ message: string; log?: { status: string } }>(
    h, '/sms/send', { to, message, purpose: 'GENERAL' }, 'SMS dispatch failed',
  );
