/**
 * SMS Gateway.
 *
 * Dispatch is deliberately labelled by what the server actually did: when no
 * live provider is configured the ledger row comes back SIMULATED, and this
 * panel says so instead of implying a message reached a patient's handset.
 * Destination numbers are masked by default — the ledger is PHI-adjacent and a
 * shared administrator screen should not display full phone numbers until asked.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Download,
  MessageSquare,
  Radio,
  Search,
  Send,
  Smartphone,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  INPUT_CLASS,
  Metric,
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
import { formatDateTime, formatNumberMasked } from '../lib/format';
import type { SmsLog, SmsStatus } from '../types';

const MAX_SEGMENT_CHARS = 160;

interface SmsSectionProps {
  smsLogs: ResourceState;
  smsStatus: ResourceState;
  actions: AdminActions;
  onRetry: () => void;
}

const SmsSection: React.FC<SmsSectionProps> = ({ smsLogs, smsStatus, actions, onRetry }) => {
  const logs = selectRows<SmsLog>(smsLogs);
  const gateway = smsStatus.data as SmsStatus | null;

  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [revealNumbers, setRevealNumbers] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 200);

  const metrics = useMemo(() => {
    let delivered = 0;
    let simulated = 0;
    let failed = 0;
    logs.forEach(log => {
      if (log.status === 'DELIVERED') delivered += 1;
      else if (log.status === 'SIMULATED') simulated += 1;
      else if (log.status === 'FAILED') failed += 1;
    });
    return { total: logs.length, delivered, simulated, failed };
  }, [logs]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(log => log.status && set.add(log.status));
    return [...set].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return logs.filter(log => {
      if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        log.to?.toLowerCase().includes(needle)
        || log.message?.toLowerCase().includes(needle)
        || log.purpose?.toLowerCase().includes(needle)
      );
    });
  }, [logs, debouncedQuery, statusFilter]);

  const { page, visible, setPage, total } = usePagedRows(filtered, 15);

  const dispatch = useCallback(async () => {
    const trimmed = to.trim();
    const body = message.trim();
    if (!trimmed || !body) return;
    const result = await actions.dispatchSms(trimmed, body);
    if (result.ok) setMessage('');
  }, [actions, message, to]);

  const exportLedger = useCallback(() => {
    const csv = toCsv(
      ['Sent at', 'Destination', 'Purpose', 'Status', 'Provider', 'Message'],
      filtered.map(log => [log.sentAt, log.to, log.purpose, log.status, log.provider, log.message]),
    );
    downloadCsv(csvFileName('sms-ledger'), csv);
  }, [filtered]);

  const segments = Math.max(1, Math.ceil(message.length / MAX_SEGMENT_CHARS));

  return (
    <ResourceGate
      resources={[smsLogs]}
      onRetry={onRetry}
      skeleton={<div className="space-y-6"><SkeletonGrid cards={4} /><SkeletonRows rows={6} /></div>}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          title="Gateway configuration"
          icon={Radio}
          description="Reported by GET /sms/status. Credentials are never exposed to the client."
          className="xl:col-span-1"
        >
          {smsStatus.status === 'error' ? (
            <EmptyState icon={Smartphone} title="Gateway status unavailable" description={smsStatus.error || 'The status endpoint did not respond.'} />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone={gateway?.isLiveConfigured ? 'success' : 'warning'}>
                  {gateway?.isLiveConfigured ? 'LIVE PROVIDER CONFIGURED' : 'SIMULATION MODE'}
                </Badge>
                <Badge tone="neutral">PROVIDER: {gateway?.activeProvider ?? 'NONE'}</Badge>
              </div>
              <Metric label="Default sender" value={gateway?.defaultSenderNumber ?? 'Not configured'} tone="info" />
              <p className="text-[11px] leading-relaxed text-slate-400">
                {gateway?.isLiveConfigured
                  ? 'Messages dispatched here are handed to the configured provider and billed. Keep the body free of diagnoses and other PHI.'
                  : 'No live provider is configured, so dispatches are recorded in the ledger as SIMULATED and never leave the server. Test flows only.'}
              </p>
            </div>
          )}
        </Panel>

        <Panel
          title="Dispatch a notification"
          icon={Send}
          description="Administrative test dispatch. Every send is written to the audit ledger and the chained audit log."
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Destination number" required className="sm:col-span-1">
              <input
                value={to}
                onChange={event => setTo(event.target.value)}
                inputMode="tel"
                autoComplete="off"
                placeholder="+1 555 0100"
                className={`${INPUT_CLASS} font-mono`}
              />
            </Field>
            <Field
              label="Message body"
              required
              className="sm:col-span-2"
              hint={<span className="font-mono text-[10px] text-slate-500">{message.length} chars · {segments} segment(s)</span>}
            >
              <textarea
                value={message}
                onChange={event => setMessage(event.target.value.slice(0, MAX_SEGMENT_CHARS * 3))}
                rows={4}
                placeholder="Appointment reminder — join your telehealth consultation from the portal."
                className={`${INPUT_CLASS} resize-y`}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              Recipient consent and quiet hours are the operator’s responsibility; this dispatch is attributed to you.
            </p>
            <Button
              variant="primary"
              icon={Send}
              busy={actions.pending === 'sms'}
              disabled={!to.trim() || !message.trim()}
              onClick={() => void dispatch()}
            >
              Send message
            </Button>
          </div>
        </Panel>
      </div>

      <Panel
        title="Dispatch ledger"
        icon={MessageSquare}
        description="Newest first. Status comes from the provider callback or the simulation result."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search number, purpose or body"
                aria-label="Search SMS ledger"
                className={`${INPUT_CLASS} w-56 pl-8`}
              />
            </div>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              aria-label="Filter by delivery status"
              className={`${INPUT_CLASS} w-36`}
            >
              <option value="ALL">All statuses</option>
              {statusOptions.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <Button variant="ghost" onClick={() => setRevealNumbers(current => !current)} aria-pressed={revealNumbers}>
              {revealNumbers ? 'Mask numbers' : 'Reveal numbers'}
            </Button>
            <Button variant="secondary" icon={Download} onClick={exportLedger} disabled={filtered.length === 0}>
              Export
            </Button>
          </>
        }
        bodyClassName="p-0"
      >
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          <Metric label="Total dispatched" value={metrics.total} tone="info" />
          <Metric label="Delivered" value={metrics.delivered} tone="success" />
          <Metric label="Simulated" value={metrics.simulated} tone={metrics.simulated ? 'warning' : 'neutral'} />
          <Metric label="Failed" value={metrics.failed} tone={metrics.failed ? 'danger' : 'neutral'} />
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon={MessageSquare}
              title={logs.length === 0 ? 'No messages have been dispatched' : 'No message matches these filters'}
              description={
                logs.length === 0
                  ? 'The gateway has an empty ledger in this environment.'
                  : 'Clear the search term or reset the status filter.'
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="bg-slate-900/70 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Sent</th>
                    <th scope="col" className="px-3 py-3">Destination</th>
                    <th scope="col" className="px-3 py-3">Purpose</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3">Provider</th>
                    <th scope="col" className="px-5 py-3">Body</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visible.map(log => (
                    <tr key={log.id} className="align-top hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-400">{formatDateTime(log.sentAt)}</td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-200">
                        {revealNumbers ? log.to : formatNumberMasked(log.to)}
                      </td>
                      <td className="px-3 py-3 text-slate-300">{log.purpose}</td>
                      <td className="px-3 py-3">
                        <Badge tone={log.status === 'DELIVERED' ? 'success' : log.status === 'FAILED' ? 'danger' : 'warning'}>
                          {log.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 font-mono text-[10px] text-slate-400">{log.provider}</td>
                      <td className="max-w-[320px] px-5 py-3 text-slate-300">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={15} total={total} onPage={setPage} />
          </>
        )}
      </Panel>
    </ResourceGate>
  );
};

export default React.memo(SmsSection);
