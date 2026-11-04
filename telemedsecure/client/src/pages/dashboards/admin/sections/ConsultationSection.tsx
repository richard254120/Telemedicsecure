/**
 * Consultation Oversight.
 *
 * An administrator is returned *every* consultation platform-wide (GET
 * /consultations applies no filter for the ADMIN role) and is authorised inside
 * each booking-lifecycle handler to action any booking. This panel turns that
 * into an operations queue: the bookings awaiting a decision, those running today,
 * and a searchable ledger where an admin can accept, decline, reschedule or
 * cancel on a busy clinician's behalf. Every decision is attributed server-side
 * and the affected rows are re-pulled the moment the socket reports the change.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Download,
  Search,
  Stethoscope,
  Video,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  INPUT_CLASS,
  Metric,
  Modal,
  Pagination,
  Panel,
  ResourceGate,
  SkeletonGrid,
  SkeletonRows,
} from '../components/ui';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePagedRows } from '../hooks/usePagedRows';
import { selectRows, type ResourceState } from '../hooks/useAdminData';
import type { AdminActions } from '../hooks/useAdminActions';
import { csvFileName, downloadCsv, toCsv } from '../lib/csv';
import { formatDateTime } from '../lib/format';
import { handoffBadge } from '../../../../dashboard-shell/handoff';
import type { AdminConsultation } from '../types';

const ACTIVE_STATES = ['PENDING', 'CONFIRMED', 'SCHEDULED'];

type ActionMode = 'decline' | 'reschedule' | 'cancel';

interface ActionTarget {
  mode: ActionMode;
  consultation: AdminConsultation;
}

interface ConsultationSectionProps {
  consultations: ResourceState;
  actions: AdminActions;
  onRetry: () => void;
}

const nameOf = (who?: { firstName: string | null; lastName: string | null; email: string | null } | null) =>
  who ? [who.firstName, who.lastName].filter(Boolean).join(' ') || who.email || '—' : '—';

/** Pre-fill a reschedule datetime-local input seven days from now. */
function defaultRescheduleValue(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ConsultationSection: React.FC<ConsultationSectionProps> = ({ consultations, actions, onRetry }) => {
  const rows = useMemo(() => selectRows<AdminConsultation>(consultations), [consultations.data]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const debouncedQuery = useDebouncedValue(query, 200);

  const [target, setTarget] = useState<ActionTarget | null>(null);
  const [reason, setReason] = useState('');
  const [when, setWhen] = useState(defaultRescheduleValue());

  const metrics = useMemo(() => {
    const now = new Date();
    const isToday = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    };
    return {
      total: rows.length,
      pending: rows.filter(r => r.status === 'PENDING').length,
      today: rows.filter(r => isToday(r.scheduledAt) && ACTIVE_STATES.includes(r.status)).length,
      inProgress: rows.filter(r => r.status === 'IN_PROGRESS').length,
      completed: rows.filter(r => r.status === 'COMPLETED').length,
      cancelled: rows.filter(r => ['CANCELLED', 'DECLINED'].includes(r.status)).length,
    };
  }, [rows]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => r.status && set.add(r.status));
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return rows
      .filter(r => {
        if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
        if (!needle) return true;
        return (
          nameOf(r.patient).toLowerCase().includes(needle)
          || nameOf(r.doctor).toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }, [rows, debouncedQuery, statusFilter]);

  const { page, visible, setPage, total } = usePagedRows(filtered, 12);

  const closeTarget = useCallback(() => setTarget(null), []);

  const openTarget = useCallback((mode: ActionMode, consultation: AdminConsultation) => {
    setReason('');
    setWhen(defaultRescheduleValue());
    setTarget({ mode, consultation });
  }, []);

  const accept = useCallback(
    (c: AdminConsultation) => void actions.actionBooking(c.id, 'accept', 'accepted'),
    [actions],
  );

  const submitAction = useCallback(() => {
    if (!target) return;
    const { mode, consultation } = target;
    if (mode === 'reschedule') {
      const iso = new Date(when).toISOString();
      void actions.actionBooking(consultation.id, 'reschedule', 'rescheduled', { newScheduledAt: iso, reason: reason.trim() || undefined });
    } else if (mode === 'decline') {
      void actions.actionBooking(consultation.id, 'decline', 'declined', { reason: reason.trim() || undefined });
    } else {
      void actions.actionBooking(consultation.id, 'cancel', 'cancelled', { reason: reason.trim() || 'Cancelled by an administrator.' });
    }
    closeTarget();
  }, [actions, closeTarget, reason, target, when]);

  const exportLedger = useCallback(() => {
    const csv = toCsv(
      ['Scheduled', 'Patient', 'Clinician', 'Status', 'Consultation ID'],
      filtered.map(r => [r.scheduledAt, nameOf(r.patient), nameOf(r.doctor), r.status, r.id]),
    );
    downloadCsv(csvFileName('consultation-oversight'), csv);
  }, [filtered]);

  const actionBusy = (id: string, action: string) => actions.pending === `booking:${id}:${action}`;

  return (
    <ResourceGate
      resources={[consultations]}
      onRetry={onRetry}
      skeleton={<div className="space-y-6"><SkeletonGrid cards={6} /><SkeletonRows rows={8} /></div>}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Total" value={metrics.total} tone="info" />
        <Metric label="Awaiting decision" value={metrics.pending} tone={metrics.pending ? 'warning' : 'neutral'} hint="Pending bookings" />
        <Metric label="Today" value={metrics.today} tone="purple" hint="Active on the calendar" />
        <Metric label="In progress" value={metrics.inProgress} tone="success" />
        <Metric label="Completed" value={metrics.completed} tone="info" />
        <Metric label="Cancelled / declined" value={metrics.cancelled} tone={metrics.cancelled ? 'danger' : 'neutral'} />
      </div>

      <Panel
        title="Consultation ledger"
        icon={Stethoscope}
        description="Every booking across the platform, newest first. An administrator may action any of them."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search patient or clinician"
                aria-label="Search consultations"
                className={`${INPUT_CLASS} w-56 pl-8`}
              />
            </div>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className={`${INPUT_CLASS} w-36`}
            >
              <option value="ALL">All statuses</option>
              {statusOptions.map(option => <option key={option} value={option}>{handoffBadge(option).label}</option>)}
            </select>
            <Button variant="secondary" icon={Download} onClick={exportLedger} disabled={filtered.length === 0}>
              Export
            </Button>
          </>
        }
        bodyClassName="p-0"
      >
        {filtered.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={Calendar}
              title={rows.length === 0 ? 'No consultations booked yet' : 'No booking matches these filters'}
              description={rows.length === 0 ? 'Self-bookings and scheduled visits will appear here.' : 'Adjust the search term or status filter.'}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-slate-900/70 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Scheduled</th>
                    <th scope="col" className="px-3 py-3">Patient</th>
                    <th scope="col" className="px-3 py-3">Clinician</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visible.map(c => {
                    const badge = handoffBadge(c.status);
                    const active = ACTIVE_STATES.includes(c.status);
                    return (
                      <tr key={c.id} className="align-middle hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-300">{formatDateTime(c.scheduledAt)}</td>
                        <td className="px-3 py-3 text-slate-200">{nameOf(c.patient)}</td>
                        <td className="px-3 py-3 text-slate-300">{nameOf(c.doctor)}</td>
                        <td className="px-3 py-3"><Badge tone={badge.tone}>{badge.label}</Badge></td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {c.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => accept(c)}
                                  disabled={actionBusy(c.id, 'accept')}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                                </button>
                                <button
                                  onClick={() => openTarget('decline', c)}
                                  disabled={actionBusy(c.id, 'decline')}
                                  className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 transition hover:bg-rose-600/80 hover:text-white disabled:opacity-50"
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Decline
                                </button>
                              </>
                            )}
                            {active && (
                              <>
                                <button
                                  onClick={() => openTarget('reschedule', c)}
                                  disabled={actionBusy(c.id, 'reschedule')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 transition hover:border-cyan-500/60 hover:text-cyan-200 disabled:opacity-50"
                                >
                                  <CalendarClock className="h-3.5 w-3.5" /> Reschedule
                                </button>
                                <button
                                  onClick={() => openTarget('cancel', c)}
                                  disabled={actionBusy(c.id, 'cancel')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 transition hover:border-rose-500/60 hover:text-rose-200 disabled:opacity-50"
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Cancel
                                </button>
                              </>
                            )}
                            {c.status === 'IN_PROGRESS' && (
                              <Badge tone="success" mono={false}>
                                <Video className="h-3 w-3" /> Live
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={12} total={total} onPage={setPage} />
          </>
        )}
      </Panel>

      <Modal
        open={!!target}
        onClose={closeTarget}
        title={target ? (target.mode === 'reschedule' ? 'Reschedule consultation' : target.mode === 'decline' ? 'Decline booking' : 'Cancel consultation') : ''}
        description={target ? `${nameOf(target.consultation.patient)} · ${formatDateTime(target.consultation.scheduledAt)}` : ''}
        icon={target?.mode === 'reschedule' ? CalendarClock : XCircle}
        tone={target?.mode === 'reschedule' ? 'info' : 'danger'}
        footer={
          <>
            <Button variant="ghost" onClick={closeTarget}>Back</Button>
            <Button variant={target?.mode === 'reschedule' ? 'primary' : 'danger'} onClick={submitAction} disabled={target?.mode === 'reschedule' && !when}>
              Confirm
            </Button>
          </>
        }
      >
        {target?.mode === 'reschedule' ? (
          <Field label="New appointment time" required hint={<span className="font-mono text-[10px] text-slate-500">The patient is notified automatically.</span>}>
            <input type="datetime-local" value={when} onChange={event => setWhen(event.target.value)} className={`${INPUT_CLASS} font-mono`} />
          </Field>
        ) : (
          <Field label={target?.mode === 'decline' ? 'Reason for declining' : 'Cancellation reason'}>
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value)}
              rows={4}
              placeholder={target?.mode === 'decline' ? 'Clinician unavailable — the patient can pick another time.' : 'Optional context for the audit trail.'}
              className={`${INPUT_CLASS} resize-y`}
            />
          </Field>
        )}
      </Modal>
    </ResourceGate>
  );
};

export default React.memo(ConsultationSection);
