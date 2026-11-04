/**
 * Compliance & Alerts.
 *
 * The previous version of this panel derived its headline figures from
 * `severityCounts.CRITICAL || 2` and read each rule's regulation off
 * `v.rule?.regulation` — a relation the violations endpoint never `include`d, so
 * the lookup was always `undefined` and every violation collapsed into a
 * catch-all bucket labelled "5". Severity counts, rule grouping, and the chain
 * verdict below are all computed from the actual payloads.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Link2,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import ChartBlock from '../components/ChartBlock';
import type { ChartDatum } from '../components/ChartBlock';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
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
import type { ActionResult } from '../hooks/useAdminActions';
import { csvFileName, downloadCsv, toCsv } from '../lib/csv';
import {
  UNREPORTED,
  formatCount,
  formatDateTime,
  severityTone,
  type Tone,
} from '../lib/format';
import type { ChainVerificationReport, ComplianceViolation, SecurityAlert, Severity } from '../types';

const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f59e0b',
  MEDIUM: '#06b6d4',
  LOW: '#64748b',
};

const VIEWPORT_FILTERS = ['ALL', 'UNRESOLVED', 'RESOLVED'] as const;
type ViewportFilter = (typeof VIEWPORT_FILTERS)[number];

interface ComplianceSectionProps {
  violations: ResourceState;
  alerts: ResourceState;
  chain: ResourceState;
  operatorName: string;
  onRetry: () => void;
  onReverify: () => void;
  onResolve: (violationId: string, note?: string) => Promise<ActionResult>;
}

const ComplianceSection: React.FC<ComplianceSectionProps> = ({
  violations,
  alerts,
  chain,
  operatorName,
  onRetry,
  onReverify,
  onResolve,
}) => {
  const rows = selectRows<ComplianceViolation>(violations);
  const feed = selectRows<SecurityAlert>(alerts);
  const report = chain.data as ChainVerificationReport | null;

  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'ALL' | Severity>('ALL');
  const [viewport, setViewport] = useState<ViewportFilter>('UNRESOLVED');
  const [pendingResolve, setPendingResolve] = useState<ComplianceViolation | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 200);

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    rows.forEach(violation => {
      if (violation.severity in counts) counts[violation.severity] += 1;
    });
    return counts;
  }, [rows]);

  const unresolvedTotal = useMemo(() => rows.filter(violation => !violation.resolved).length, [rows]);

  /* Group by the violation's own ruleId — the Prisma row carries it directly. */
  const ruleSeries = useMemo<ChartDatum[]>(() => {
    const tally = new Map<string, number>();
    rows.forEach(violation => {
      const key = violation.ruleId || violation.type || 'UNATTRIBUTED';
      tally.set(key, (tally.get(key) ?? 0) + 1);
    });
    return [...tally.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [rows]);

  const severitySeries = useMemo<ChartDatum[]>(
    () => SEVERITIES
      .map(level => ({ name: level, value: severityCounts[level], color: SEVERITY_COLOR[level] }))
      .filter(point => point.value > 0),
    [severityCounts],
  );

  const filtered = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return rows.filter(violation => {
      if (viewport === 'UNRESOLVED' && violation.resolved) return false;
      if (viewport === 'RESOLVED' && !violation.resolved) return false;
      if (severity !== 'ALL' && violation.severity !== severity) return false;
      if (!needle) return true;
      return (
        violation.description?.toLowerCase().includes(needle)
        || violation.ruleId?.toLowerCase().includes(needle)
        || violation.hipaaClause?.toLowerCase().includes(needle)
        || violation.gdprClause?.toLowerCase().includes(needle)
      );
    });
  }, [rows, debouncedQuery, severity, viewport]);

  const { page, visible, setPage, total } = usePagedRows(filtered, 15);
  const alertWindow = usePagedRows(feed, 8);

  const exportViolations = useCallback(() => {
    const csv = toCsv(
      ['Reported at', 'Severity', 'Rule', 'Type', 'HIPAA', 'GDPR', 'Status', 'Description', 'Resource', 'Subject'],
      filtered.map(violation => [
        violation.reportedAt,
        violation.severity,
        violation.ruleId,
        violation.type,
        violation.hipaaClause ?? '',
        violation.gdprClause ?? '',
        violation.resolved ? 'RESOLVED' : 'OPEN',
        violation.description,
        violation.resource ?? '',
        violation.userId ?? 'platform-wide',
      ]),
    );
    downloadCsv(csvFileName('compliance-violations'), csv);
  }, [filtered]);

  const confirmResolve = useCallback(async () => {
    if (!pendingResolve) return;
    setResolving(true);
    try {
      const result = await onResolve(pendingResolve.id, resolveNote.trim() || undefined);
      if (result.ok) {
        setPendingResolve(null);
        setResolveNote('');
      }
    } finally {
      setResolving(false);
    }
  }, [onResolve, pendingResolve, resolveNote]);

  const chainTone: Tone = chain.status === 'error'
    ? 'danger'
    : report?.isValid
      ? 'success'
      : report
        ? 'danger'
        : 'neutral';

  return (
    <ResourceGate
      resources={[violations, alerts]}
      onRetry={onRetry}
      skeleton={<div className="space-y-6"><SkeletonGrid cards={4} /><SkeletonRows rows={6} /></div>}
    >
      {/* Hash-chain attestation */}
      <Panel
        title="Audit chain attestation"
        icon={Link2}
        description="Recomputed on demand by GET /integrity/verify: every event hash is re-linked and the Merkle root is compared against the on-chain anchor."
        actions={
          <>
            {chain.status === 'error' ? (
              <Badge tone="danger"><XCircle className="h-3 w-3" /> VERIFICATION UNAVAILABLE</Badge>
            ) : report ? (
              <Badge tone={chainTone}>
                {report.isValid ? <CheckCircle2 className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {report.isValid ? 'CHAIN VALID' : `CHAIN ${report.status}`}
              </Badge>
            ) : (
              <Badge tone="neutral"><RefreshCw className="h-3 w-3" /> PENDING</Badge>
            )}
            <Button variant="secondary" icon={RefreshCw} busy={chain.status === 'loading'} onClick={onReverify}>
              Re-verify
            </Button>
          </>
        }
      >
        {chain.status === 'error' ? (
          <ErrorState compact message={chain.error || 'The integrity endpoint did not respond.'} onRetry={onReverify} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Events in chain" value={report?.totalEvents} tone="info" />
            <Metric label="Local linkage" value={report ? (report.chainIntact ? 'INTACT' : 'BROKEN') : UNREPORTED} tone={report?.chainIntact ? 'success' : 'danger'} />
            <Metric label="Anchors checked" value={report ? formatCount(report.anchorsChecked) : UNREPORTED} tone="purple" />
            <Metric label="On-chain match" value={report ? (report.onChainVerified ? 'CONFIRMED' : 'NOT VERIFIED') : UNREPORTED} tone={report?.onChainVerified ? 'success' : 'warning'} />
            <Metric label="Open violations" value={unresolvedTotal} tone={unresolvedTotal > 0 ? 'warning' : 'success'} />
            <Metric label="Last verified" value={report ? formatDateTime(report.verifiedAt) : UNREPORTED} tone="neutral" />
          </div>
        )}

        {report && !report.isValid && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="flex items-center gap-2 text-xs font-bold text-red-200">
              <ShieldAlert className="h-4 w-4" />
              Tampering detected — escalate before closing this panel
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {report.brokenEvent
                ? `Event #${report.brokenEvent.index} ("${report.brokenEvent.action}" on ${report.brokenEvent.resource}) fails its hash link: ${report.brokenEvent.reason}.`
                : 'The recomputed Merkle root does not match the anchor stored on-chain.'}
            </p>
          </div>
        )}
      </Panel>

      {/* Distribution */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Severity distribution"
          icon={AlertTriangle}
          description={`Across ${formatCount(rows.length)} stored violation records`}
          actions={<Badge tone="danger">{formatCount(severityCounts.CRITICAL)} CRITICAL</Badge>}
        >
          <ChartBlock variant="donut" data={severitySeries} height={240} emptyLabel="No violations recorded — the rules engine is quiet" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SEVERITIES.map(level => (
              <Metric key={level} label={level} value={severityCounts[level]} tone={severityTone(level)} unreported={false} />
            ))}
          </div>
        </Panel>

        <Panel title="Most-triggered rules" icon={Scale} description="Grouped by the ruleId stored on each violation">
          <ChartBlock variant="bar" data={ruleSeries} height={280} emptyLabel="No rule has fired yet" />
        </Panel>
      </div>

      {/* Violations register */}
      <Panel
        title="Violation register"
        icon={ShieldCheck}
        description="Each row is a rules-engine finding with its regulatory clause attached."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search rule, clause or description"
                aria-label="Search violations"
                className={`${INPUT_CLASS} w-56 pl-8`}
              />
            </div>
            <select
              value={severity}
              onChange={event => setSeverity(event.target.value as 'ALL' | Severity)}
              aria-label="Filter by severity"
              className={`${INPUT_CLASS} w-32`}
            >
              <option value="ALL">All severities</option>
              {SEVERITIES.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
            <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-0.5">
              {VIEWPORT_FILTERS.map(filter => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => { setViewport(filter); setPage(0); }}
                  aria-pressed={viewport === filter}
                  className={`rounded-[10px] px-2.5 py-1 font-mono text-[10px] font-bold transition ${
                    viewport === filter ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <Button variant="secondary" icon={Download} onClick={exportViolations} disabled={filtered.length === 0}>
              Export
            </Button>
          </>
        }
        bodyClassName="p-0"
      >
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ShieldCheck}
              title={rows.length === 0 ? 'No violations have been recorded' : 'No violation matches these filters'}
              description={
                rows.length === 0
                  ? 'The compliance engine has not flagged anything in this environment. This is a real result, not a default.'
                  : 'Widen the severity or status filter to see more records.'
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="bg-slate-900/70 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Severity</th>
                    <th scope="col" className="px-3 py-3">Rule / clause</th>
                    <th scope="col" className="px-3 py-3">Finding</th>
                    <th scope="col" className="px-3 py-3">Reported</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visible.map(violation => (
                    <tr key={violation.id} className="align-top hover:bg-slate-800/40">
                      <td className="px-5 py-3"><Badge tone={severityTone(violation.severity)}>{violation.severity}</Badge></td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-[11px] text-slate-200">{violation.ruleId || UNREPORTED}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                          {violation.hipaaClause ? `HIPAA ${violation.hipaaClause}` : UNREPORTED}
                          {violation.gdprClause ? ` · GDPR ${violation.gdprClause}` : ''}
                        </p>
                      </td>
                      <td className="max-w-[380px] px-3 py-3">
                        <p className="text-slate-200">{violation.description}</p>
                        {violation.resource && (
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500">resource: {violation.resource}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-400">{formatDateTime(violation.reportedAt)}</td>
                      <td className="px-3 py-3">
                        <Badge tone={violation.resolved ? 'success' : 'warning'}>
                          {violation.resolved ? 'CLOSED' : 'OPEN'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {violation.resolved ? (
                          <span className="font-mono text-[10px] text-slate-500">—</span>
                        ) : (
                          <Button
                            variant="success"
                            icon={CheckCircle2}
                            onClick={() => { setPendingResolve(violation); setResolveNote(''); }}
                          >
                            Close
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={15} total={total} onPage={setPage} />
          </>
        )}
      </Panel>

      {/* Live security feed */}
      <Panel
        title="Security alert feed"
        icon={AlertTriangle}
        description="Signals raised by the monitoring rules; newest first."
        actions={<Badge tone="info">{formatCount(feed.length)} EVENTS</Badge>}
        bodyClassName="p-0"
      >
        {feed.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ShieldCheck}
              title="No security alerts in this window"
              description="Nothing has been raised against the monitored rules. Alerts appear here as soon as they are persisted."
            />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-800">
              {alertWindow.visible.map(alert => (
                <li key={alert.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                  <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-100">{alert.title || alert.ruleId || 'Security alert'}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{alert.description}</p>
                    {alert.sourceIp && (
                      <p className="mt-0.5 font-mono text-[10px] text-slate-500">source {alert.sourceIp}</p>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">{formatDateTime(alert.createdAt)}</span>
                </li>
              ))}
            </ul>
            <Pagination page={alertWindow.page} pageSize={8} total={alertWindow.total} onPage={alertWindow.setPage} />
          </>
        )}
      </Panel>

      <Modal
        open={!!pendingResolve}
        onClose={() => setPendingResolve(null)}
        title="Close compliance violation"
        description="The record is kept and marked resolved, with you as the closing officer. This is written to the hash-chained audit log."
        icon={CheckCircle2}
        tone="success"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingResolve(null)} disabled={resolving}>Cancel</Button>
            <Button variant="success" icon={CheckCircle2} busy={resolving} onClick={confirmResolve}>
              Mark resolved
            </Button>
          </>
        }
      >
        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-xs">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Finding</p>
          <p className="mt-1 text-slate-200">{pendingResolve?.description}</p>
          <p className="mt-2 font-mono text-[10px] text-slate-500">
            rule {pendingResolve?.ruleId || UNREPORTED} · closing officer {operatorName}
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Remediation note (optional)
          </span>
          <textarea
            value={resolveNote}
            onChange={event => setResolveNote(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="What was done to remediate this finding?"
            className={`${INPUT_CLASS} resize-y`}
          />
        </label>
      </Modal>
    </ResourceGate>
  );
};

export default React.memo(ComplianceSection);
