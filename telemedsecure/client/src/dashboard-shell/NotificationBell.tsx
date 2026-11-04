/**
 * Self-contained booking / access notification bell.
 *
 * Sits in the sticky header (`Shell.headerActions`) of every dashboard and
 * surfaces the persisted, cross-session notifications the server writes for
 * booking-lifecycle and access-grant events. It owns its socket connection,
 * registers the user room, and refreshes both its badge and list live.
 *
 * Kept deliberately independent from the Doctor dashboard's ephemeral chat
 * bell: this one is the durable "what happened to my appointments / records"
 * feed (GET /api/v1/notifications + the `booking-notification` socket event).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, WS_URL } from '../config';
import type { HeadersFactory } from './transport';
import { formatDateTime } from './format';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  consultationId?: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  getAuthHeaders: HeadersFactory;
  userId?: string;
  /** Accent for the bell ring; kept subtle so it reads as chrome, not a CTA. */
  className?: string;
}

const jsonHeaders = (getAuthHeaders: HeadersFactory) => ({
  Accept: 'application/json',
  ...getAuthHeaders(),
});

export default function NotificationBell({ getAuthHeaders, userId }: NotificationBellProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications?limit=50`, { headers: jsonHeaders(getAuthHeaders) });
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnread(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } catch {
      /* transient network hiccup: keep last-known list */
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!userId) return;
    refresh();

    const socket: Socket = io(WS_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('register-user', { userId }));
    socket.on('booking-notification', (n: AppNotification) => {
      setItems((prev) => [n, ...prev.filter((p) => p.id !== n.id)].slice(0, 50));
      if (!n.read) setUnread((u) => u + 1);
    });

    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);

    return () => {
      socket.disconnect();
      document.removeEventListener('mousedown', onDocDown);
    };
  }, [userId, refresh]);

  const markRead = useCallback(async (n: AppNotification) => {
    if (n.read) return;
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch(`${API_BASE}/notifications/${n.id}/read`, { method: 'POST', headers: jsonHeaders(getAuthHeaders) });
    } catch {
      /* optimistic update already applied */
    }
  }, [getAuthHeaders]);

  const markAll = useCallback(async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    try {
      await fetch(`${API_BASE}/notifications/read-all`, { method: 'POST', headers: jsonHeaders(getAuthHeaders) });
    } catch {
      /* ignore */
    }
  }, [getAuthHeaders]);

  const dismiss = useCallback(async (n: AppNotification) => {
    setItems((prev) => prev.filter((i) => i.id !== n.id));
    if (!n.read) setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch(`${API_BASE}/notifications/${n.id}`, { method: 'DELETE', headers: jsonHeaders(getAuthHeaders) });
    } catch {
      /* ignore */
    }
  }, [getAuthHeaders]);

  const openItem = useCallback(async (n: AppNotification) => {
    await markRead(n);
    setOpen(false);
    if (n.link) {
      // Same-route links (e.g. a booking link clicked while already on the
      // dashboard) still resolve; react-router ignores identical navigations
      // but the read-state and dropdown close above are the primary feedback.
      navigate(n.link);
    }
  }, [markRead, navigate]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) refresh(); }}
        className="relative px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/40 text-xs font-semibold transition flex items-center space-x-1.5"
        title="Booking & access notifications"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono leading-[18px] text-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,26rem)] max-h-[70vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-slate-400">Notifications</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAll}
                disabled={unread === 0}
                className="text-[11px] font-semibold text-cyan-300 disabled:text-slate-600 hover:text-cyan-200 flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            </div>
          </div>

          <div className="overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {items.map((n) => (
                  <li key={n.id} className={`group flex items-start gap-3 px-4 py-3 ${n.read ? 'opacity-70' : 'bg-slate-800/40'}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-cyan-400'}`} />
                    <button type="button" onClick={() => openItem(n)} className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-semibold text-slate-100 truncate">{n.title}</p>
                      <p className="text-xs text-slate-400 line-clamp-2">{n.body}</p>
                      <p className="mt-1 text-[11px] font-mono text-slate-500">{formatDateTime(n.createdAt)}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(n)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-rose-300 hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition"
                      aria-label="Dismiss notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
