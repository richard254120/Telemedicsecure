import { Server, Socket } from 'socket.io';
import { SecurityAlert, ComplianceViolation } from '@prisma/client';

let ioInstance: Server | null = null;

export const setIO = (io: Server) => {
  ioInstance = io;
};

export const getIO = (): Server | null => {
  return ioInstance;
};

export const broadcastAlertToAdmins = (alert: SecurityAlert, violation?: ComplianceViolation) => {
  if (!ioInstance) {
    console.warn('[Socket] No ioInstance initialized for alert broadcast');
    return;
  }

  const payload = {
    alert,
    violation,
    timestamp: new Date().toISOString(),
  };

  // Push to admins room specifically
  ioInstance.to('admins').emit('security-alert', payload);
  if (violation) {
    ioInstance.to('admins').emit('compliance-violation', violation);
  }

  // Also broadcast to root so any connected admin client that hasn't joined room also receives it
  ioInstance.emit('live-security-alert', payload);
  console.log(`[Socket] Broadcasted SecurityAlert [${alert.severity}] to admins: ${alert.title || alert.description}`);
};

/**
 * Push a lightweight operations signal to every connected administrator so the
 * admin console can refresh the affected panel in real time (new bookings,
 * booking decisions, payments, claim adjudications, GDPR erasures).
 *
 * Deliberately carries no PHI: it is a "something changed, refetch" hint keyed
 * by a domain kind, not a payload of patient data. Admins receive it through the
 * `admins` room (join-admin) and the `role-ADMIN` room (register-user), so it
 * lands whether or not the client used the admin handshake.
 */
export const broadcastAdminOps = (kind: string, meta: Record<string, unknown> = {}) => {
  if (!ioInstance) return;
  const event = { kind, meta, timestamp: new Date().toISOString() };
  ioInstance.to('admins').emit('admin-live-event', event);
  ioInstance.to('role-ADMIN').emit('admin-live-event', event);
};
