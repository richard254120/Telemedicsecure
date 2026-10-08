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
