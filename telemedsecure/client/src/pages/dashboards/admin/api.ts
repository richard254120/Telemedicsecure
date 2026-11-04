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
import {
  AUTH_EXPIRED_EVENT,
  ApiError,
  errorMessage,
  isAbortError,
  get,
  put,
  post,
  del,
  type HeadersFactory,
} from '../../../dashboard-shell/transport';

// Re-export the generic transport so existing `api.*` call sites keep working.
export { AUTH_EXPIRED_EVENT, ApiError, errorMessage, isAbortError };
export type { HeadersFactory };
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
