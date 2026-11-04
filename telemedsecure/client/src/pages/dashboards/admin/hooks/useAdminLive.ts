/**
 * Live operations feed for the admin console.
 *
 * The server pushes a lightweight, PHI-free `admin-live-event` to the `admins`
 * and `role-ADMIN` socket rooms whenever a booking is created or actioned, a
 * payment is settled, a claim is adjudicated, or a GDPR erasure/export runs
 * (see `broadcastAdminOps` on the server). This hook owns a single socket for
 * the console, performs the admin handshake, and coalesces the bursts of events
 * that a single operator action can trigger (e.g. booking → notify → audit) into
 * one debounced refetch of whatever panel is currently mounted.
 *
 * It deliberately does not know about resources or the active tab: the caller
 * supplies `onEvent`, so the store stays the single owner of what gets refetched.
 */
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_URL } from '../../../../config';

export interface AdminLiveEvent {
  kind?: string;
  meta?: Record<string, unknown>;
  timestamp?: string;
}

export interface AdminLive {
  connected: boolean;
  lastEventAt: number | null;
}

/** How long to wait for further events before firing a single refresh. */
const DEBOUNCE_MS = 500;

export function useAdminLive(
  userId: string | undefined,
  role: string | undefined,
  onEvent: (event: AdminLiveEvent) => void,
): AdminLive {
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  // Keep the latest callback without re-establishing the socket on every render.
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!userId) return;

    const socket: Socket = io(WS_URL, { transports: ['websocket', 'polling'] });
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (event: AdminLiveEvent) => {
      setLastEventAt(Date.now());
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => handlerRef.current(event), DEBOUNCE_MS);
    };

    socket.on('connect', () => {
      setConnected(true);
      // Join the per-user room (role-ADMIN is joined server-side from this) and
      // the dedicated admins room so live signals land either way.
      socket.emit('register-user', { userId, role });
      socket.emit('join-admin', { userId, role });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('admin-live-event', schedule);
    // Reuse the existing alert pushes as refresh triggers for the integrity tab.
    socket.on('security-alert', schedule);
    socket.on('compliance-violation', schedule);
    socket.on('booking-notification', schedule);

    return () => {
      if (timer) clearTimeout(timer);
      socket.disconnect();
    };
  }, [userId, role]);

  return { connected, lastEventAt };
}
