/**
 * Admin mutations with three guarantees the previous inline handlers lacked:
 *
 *  - the invalidated resources are refreshed, not the entire endpoint fan-out;
 *  - a rejected promise always surfaces to the operator (the old handlers
 *    `console.error`-ed and left the screen looking unchanged and successful);
 *  - `pending` identifies the in-flight action so its button can lock itself,
 *    which is what stops double-provisioning and double-purge clicks.
 */
import { useCallback, useMemo, useState } from 'react';
import * as api from '../api';
import type { ResourceKey } from './useAdminData';
import type { UserRole } from '../../../../context/AuthContext';
import type { VerificationStatus } from '../types';
import type { ToastTone } from './useToast';

/**
 * Outcome of a mutation. `T` defaults to `unknown` rather than `undefined` so a
 * caller that only cares about `ok`/`message` can accept any endpoint's payload
 * without a cast, while callers that do read `data` narrow it explicitly.
 */
export interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

type HeadersFactory = () => Record<string, string>;
type Notify = (message: string, tone?: ToastTone, ttlMs?: number) => void;

export interface AdminActionsConfig {
  getAuthHeaders: HeadersFactory;
  notify: Notify;
  refresh: (keys?: ResourceKey[]) => Promise<void>;
}

export interface ProvisionResult {
  name: string;
  email: string;
  role: UserRole;
  temporaryPassword: string;
}

export interface InvitationResult {
  link: string;
  email: string;
  expiresInMinutes: number;
}

export function useAdminActions({ getAuthHeaders, notify, refresh }: AdminActionsConfig) {
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(async <T,>(
    id: string,
    work: () => Promise<T>,
    successMessage: (result: T) => string,
    invalidate: ResourceKey[],
  ): Promise<ActionResult<T>> => {
    setPending(id);
    try {
      const result = await work();
      await refresh(invalidate);
      notify(successMessage(result), 'success');
      return { ok: true, data: result };
    } catch (err) {
      // An aborted read is our own cancellation, not an operator-visible fault.
      if (!api.isAbortError(err)) {
        notify(api.errorMessage(err, 'The action could not be completed.'), 'error', 8000);
      }
      return { ok: false, error: api.errorMessage(err, 'Unknown error') };
    } finally {
      setPending(null);
    }
  }, [notify, refresh]);

  const decideCredentials = useCallback(
    (userId: string, status: VerificationStatus, displayName: string) =>
      run(
        `credentials:${userId}`,
        () => api.verifyCredentials(getAuthHeaders, userId, status),
        () => `${displayName}'s credential review recorded as ${status}.`,
        ['users', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  const updateRole = useCallback(
    (userId: string, role: UserRole) =>
      run(
        `role:${userId}`,
        () => api.changeUserRole(getAuthHeaders, userId, role),
        () => `Role reassigned to ${role}.`,
        ['users', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  const setActive = useCallback(
    (userId: string, isActive: boolean, displayName: string) =>
      run(
        `status:${userId}`,
        () => api.setUserActive(getAuthHeaders, userId, isActive),
        () => `${displayName} is now ${isActive ? 'active' : 'suspended'}.`,
        ['users', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  /**
   * The server hands the fresh base32 secret back exactly once. It is returned
   * to the caller for display inside a masked panel and is never written to a
   * toast, the console, or localStorage.
   */
  const resetTotp = useCallback(
    (userId: string, displayName: string) =>
      run(
        `totp:${userId}`,
        () => api.resetUserTotp(getAuthHeaders, userId),
        () => `2FA enrolment reset for ${displayName}.`,
        ['users'],
      ),
    [getAuthHeaders, run],
  );

  const provisionStaff = useCallback(
    (input: api.ProvisionInput) =>
      run(
        'provision',
        async () => {
          const res = await api.provisionStaff(getAuthHeaders, input);
          const result: ProvisionResult = {
            name: `${input.firstName} ${input.lastName}`,
            email: input.email,
            role: input.role,
            temporaryPassword: res.temporaryPassword,
          };
          return result;
        },
        result => `${result.role} account provisioned for ${result.email}`,
        ['users', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  const createInvitation = useCallback(
    (input: api.InvitationInput) =>
      run(
        'invitation',
        async () => {
          const res = await api.createInvitation(getAuthHeaders, input);
          const link = `${window.location.origin}/login?invite=${res.token}&email=${encodeURIComponent(input.email)}`;
          const result: InvitationResult = {
            link,
            email: input.email,
            expiresInMinutes: res.expiresInMinutes,
          };
          return result;
        },
        result => `Single-use ${result.expiresInMinutes}-minute invitation issued for ${result.email}`,
        ['invitations', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  const revokeInvitation = useCallback(
    (invitationId: string) =>
      run(
        `revoke:${invitationId}`,
        () => api.revokeInvitation(getAuthHeaders, invitationId),
        () => 'Invitation revoked.',
        ['invitations', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  const purgeUsers = useCallback(
    (userIds: string[], label: string) =>
      run(
        `purge:${userIds.join('-')}`,
        async () => {
          if (userIds.length === 1) {
            await api.deleteUser(getAuthHeaders, userIds[0]);
            return { deletedCount: 1 };
          }
          return api.batchDeleteUsers(getAuthHeaders, userIds);
        },
        result => `Permanently purged ${result.deletedCount} ${label ?? 'account(s)'}`,
        ['users', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  /**
   * Closing a violation is an audit act, not a delete: the server keeps the row
   * and stamps who closed it and why, so the operator identity is always sent.
   */
  const closeViolation = useCallback(
    (violationId: string, resolvedBy: string, note?: string) =>
      run(
        `violation:${violationId}`,
        () => api.resolveViolation(getAuthHeaders, violationId, resolvedBy, note),
        () => 'Violation marked resolved and recorded in the audit trail.',
        ['violations', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  /**
   * Escalating an alert opens a tracked forensic case referencing the alert, so
   * the casework panel and the alert feed stay joined by a real id rather than a
   * copy-pasted description.
   */
  const escalateAlert = useCallback(
    (input: api.IncidentInput) =>
      run(
        `escalate:${input.alertId ?? 'manual'}`,
        () => api.openIncident(getAuthHeaders, input),
        () => `Incident opened and linked to the originating alert.`,
        ['incidents', 'alerts', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  const dispatchSms = useCallback(
    (to: string, message: string) =>
      run(
        'sms',
        () => api.sendTestSms(getAuthHeaders, to, message),
        result => `SMS queued for ${to} (gateway status: ${result.log?.status ?? 'accepted'}).`,
        ['smsLogs', 'smsStatus'],
      ),
    [getAuthHeaders, run],
  );

  /* ---------------------------------------------------------------- * 
   * Consultation oversight, finance and privacy mutations.
   * ---------------------------------------------------------------- */

  const actionBooking = useCallback(
    (consultationId: string, action: api.BookingAction, label: string, body: Record<string, unknown> = {}) =>
      run(
        `booking:${consultationId}:${action}`,
        () => api.actionBooking(getAuthHeaders, consultationId, action, body),
        () => `Booking ${label}.`,
        ['consultations', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  const settleInvoice = useCallback(
    (invoiceId: string, input: api.PayInvoiceInput) =>
      run(
        `pay:${invoiceId}`,
        () => api.payInvoice(getAuthHeaders, invoiceId, input),
        result => `Payment recorded (${result.receiptNumber}).`,
        ['invoices', 'billingStats', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  const updateClaim = useCallback(
    (claimId: string, input: api.AdjudicateClaimInput) =>
      run(
        `claim:${claimId}`,
        () => api.adjudicateClaim(getAuthHeaders, claimId, input),
        () => `Claim updated to ${input.status}.`,
        ['claims', 'invoices', 'billingStats', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  const fulfillExport = useCallback(
    (patientId: string, justification: string) =>
      run(
        `export:${patientId}`,
        () => api.requestPatientExport(getAuthHeaders, patientId, justification),
        () => 'Subject data export generated.',
        ['stats'],
      ),
    [getAuthHeaders, run],
  );

  const fulfillErasure = useCallback(
    (patientId: string, reason: string) =>
      run(
        `erasure:${patientId}`,
        () => api.executePatientErasure(getAuthHeaders, patientId, reason),
        () => 'Right-to-erasure crypto-shred executed.',
        ['erasureRequests', 'users', 'stats'],
      ),
    [getAuthHeaders, run],
  );

  // Memoised so a memo'd panel that receives this object is not re-rendered by
  // every unrelated parent state change (the toast, the active tab, a keystroke).
  return useMemo(
    () => ({
      pending,
      decideCredentials,
      updateRole,
      setActive,
      resetTotp,
      provisionStaff,
      createInvitation,
      revokeInvitation,
      purgeUsers,
      closeViolation,
      escalateAlert,
      dispatchSms,
      actionBooking,
      settleInvoice,
      updateClaim,
      fulfillExport,
      fulfillErasure,
    }),
    [
      pending,
      decideCredentials,
      updateRole,
      setActive,
      resetTotp,
      provisionStaff,
      createInvitation,
      revokeInvitation,
      purgeUsers,
      closeViolation,
      escalateAlert,
      dispatchSms,
      actionBooking,
      settleInvoice,
      updateClaim,
      fulfillExport,
      fulfillErasure,
    ],
  );
}

export type AdminActions = ReturnType<typeof useAdminActions>;
