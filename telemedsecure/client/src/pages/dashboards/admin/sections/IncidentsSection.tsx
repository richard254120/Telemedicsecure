/**
 * Incident Casework.
 *
 * Read-mostly view over GET /investigation/incidents, which already includes
 * each case's timeline, evidence findings and anchored reports. Deep work (PDF
 * generation, timeline reconstruction) stays in the dedicated Forensics Studio;
 * this panel's job is triage posture and a real escalation path from an alert to
 * a tracked case, which previously did not exist — alerts could only be read.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowRight,
  FileCheck2,
  FileSearch,
  GitBranch,
  Link2,
  Paperclip,
  ShieldAlert,
  Workflow,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  INPUT_CLASS,
  Metric,
  Panel,
  ResourceGate,
  SkeletonGrid,
  SkeletonRows,
} from '../components/ui';
import { selectRows, type ResourceState } from '../hooks/useAdminData';
import type { AdminActions } from '../hooks/useAdminActions';
import { formatDateTime, incidentTone, severityTone } from '../lib/format';
import type { Incident, SecurityAlert, Severity } from '../types';

const STATUS_TABS = ['ALL', 'OPEN', 'INVESTIGATING', 'CLOSED'] as const;

interface IncidentsSectionProps {
  incidents: ResourceState;
  alerts: ResourceState;
  actions: AdminActions;
  operatorEmail: string;
  onRetry: () => void;
}

const IncidentsSection: React.FC<IncidentsSectionProps> = ({
  incidents,
  alerts,
  actions,
  operatorEmail,
  onRetry,
}) => {
  const navigate = useNavigate();
  const cases = selectRows<Incident>(incidents);
  const feed = selectRows<SecurityAlert>(alerts);

  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>('ALL');
  const [query, setQuery] = useState('');

  const metrics = useMemo(() => {
    let open = 0;
    let investigating = 0;
    let closed = 0;
    let evidence = 0;
    let reports = 0;
    let unanchored = 0;
    cases.forEach(incident => {
      if (incident.status === 'OPEN') open += 1;
      else if (incident.status === 'INVESTIGATING') investigating += 1;
      else if (incident.status === 'CLOSED') closed += 1;
      evidence += incident.evidence?.length ?? 0;
      reports += incident.reports?.length ?? 0;
      unanchored += (incident.reports ?? []).filter(report => !report.txHash).length;
    });
    return { open, investigating, closed, evidence, reports, unanchored, total: cases.length };
  }, [cases]);

  const escalatedAlertIds = useMemo(
    () => new Set(cases.map(incident => incident.alertId).filter(Boolean) as string[]),
    [cases],
  );

  const escalatable = useMemo(
    () => feed.filter(alert => !escalatedAlertIds.has(alert.id)).slice(0, 6),
    [feed, escalatedAlertIds],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cases.filter(incident => {
      if (status !== 'ALL' && incident.status !== status) return false;
      if (!needle) return true;
      return (
        incident.title?.toLowerCase().includes(needle)
        || incident.description?.toLowerCase().includes(needle)
        || incident.openedBy?.toLowerCase().includes(needle)
      );
    });
  }, [cases, status, query]);

  const escalate = useCallback(
    (alert: SecurityAlert) =>
      void actions.escalateAlert({
        alertId: alert.id,
        title: alert.title || alert.ruleId || 'Security alert escalation',
        description: alert.description || 'Escalated from the admin compliance feed.',
        severity: (alert.severity ?? 'HIGH') as Severity,
      }),
    [actions],
  );

  return (
    <ResourceGate
      resources={[incidents]}
      onRetry={onRetry}
      skeleton={<div className="space-y-6"><SkeletonGrid cards={4} /><SkeletonRows rows={5} /></div>}
    >
      <Panel
        title="Casework posture"
        icon={Workflow}
        description="Live counts from the investigation register."
        actions={
          <>
            <Button variant="secondary" icon={FileCheck2} onClick={() => navigate('/investigation/verify')}>
              Verify report PDF
            </Button>
            <Button variant="primary" icon={FileSearch} onClick={() => navigate('/investigation')}>
              Forensics studio
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Open" value={metrics.open} tone={metrics.open ? 'danger' : 'success'} />
          <Metric label="Investigating" value={metrics.investigating} tone={metrics.investigating ? 'warning' : 'neutral'} />
          <Metric label="Closed" value={metrics.closed} tone="success" />
          <Metric label="Evidence findings" value={metrics.evidence} tone="purple" hint="SHA-256 hashed" />
          <Metric label="Reports filed" value={metrics.reports} tone="info" />
          <Metric label="Not yet anchored" value={metrics.unanchored} tone={metrics.unanchored ? 'warning' : 'success'} hint="No on-chain tx hash" />
        </div>
      </Panel>

      {escalatable.length > 0 && (
        <Panel
          title="Alerts without a case"
          icon={AlertOctagon}
          description="High-severity signals that no incident references yet. Escalating creates a tracked case linked to the alert id."
          actions={<Badge tone="warning">{escalatable.length} UNLINKED</Badge>}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-slate-800">
            {escalatable.map(alert => (
              <li key={alert.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-100">{alert.title || alert.ruleId || 'Security alert'}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{alert.description}</p>
                </div>
                <span className="font-mono text-[10px] text-slate-500">{formatDateTime(alert.createdAt)}</span>
                <Button
                  variant="danger"
                  icon={ArrowRight}
                  busy={actions.pending === `escalate:${alert.id}`}
                  onClick={() => escalate(alert)}
                >
                  Escalate
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Incident register"
        icon={ShieldAlert}
        description={`${filtered.length} case(s) shown of ${cases.length} recorded`}
        actions={
          <>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search cases"
              aria-label="Search incidents"
              className={`${INPUT_CLASS} w-48`}
            />
            <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-0.5">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatus(tab)}
                  aria-pressed={status === tab}
                  className={`rounded-[10px] px-2.5 py-1 font-mono text-[10px] font-bold transition ${
                    status === tab ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </>
        }
        bodyClassName="p-0"
      >
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={FileSearch}
              title={cases.length === 0 ? 'No forensic cases have been opened' : 'No case matches this filter'}
              description={
                cases.length === 0
                  ? 'Nothing is being suppressed: this environment has an empty incident register. Escalate an alert above to open the first case.'
                  : 'Switch the status filter back to ALL to see the rest of the register.'
              }
              action={<Button variant="primary" icon={FileSearch} onClick={() => navigate('/investigation')}>Open the forensics studio</Button>}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {filtered.map(incident => {
              const timeline = incident.timeline ?? [];
              const evidence = incident.evidence ?? [];
              const reports = incident.reports ?? [];
              return (
                <li key={incident.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={incidentTone(incident.status)}>{incident.status}</Badge>
                        <Badge tone={severityTone(incident.severity)}>{incident.severity}</Badge>
                        <span className="font-mono text-[10px] text-slate-500">CASE-{incident.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-white">{incident.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{incident.description || 'No description recorded.'}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">
                        opened {formatDateTime(incident.createdAt)} by {incident.openedBy || operatorEmail}
                        {incident.alertId ? ` · alert ${incident.alertId.slice(0, 8)}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge tone="neutral"><Link2 className="h-3 w-3" /> {timeline.length} TIMELINE</Badge>
                      <Badge tone="neutral"><Paperclip className="h-3 w-3" /> {evidence.length} EVIDENCE</Badge>
                      <Badge tone="neutral"><FileCheck2 className="h-3 w-3" /> {reports.length} REPORTS</Badge>
                    </div>
                  </div>

                  {(evidence.length > 0 || reports.length > 0) && (
                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {evidence.length > 0 && (
                        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
                          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                            <Paperclip className="h-3 w-3" /> Evidence findings
                          </p>
                          <ul className="space-y-1">
                            {evidence.slice(0, 3).map(finding => (
                              <li key={finding.id} className="text-[11px] text-slate-300">
                                {finding.description}
                                <span className="ml-1 font-mono text-[10px] text-slate-500">
                                  {finding.evidenceType} · {finding.hashValue.slice(0, 12)}…
                                </span>
                              </li>
                            ))}
                          </ul>
                          {evidence.length > 3 && (
                            <p className="mt-1 font-mono text-[10px] text-slate-500">+{evidence.length - 3} more in the studio</p>
                          )}
                        </div>
                      )}

                      {reports.length > 0 && (
                        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
                          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                            <GitBranch className="h-3 w-3" /> Anchored forensic reports
                          </p>
                          <ul className="space-y-1.5">
                            {reports.slice(0, 3).map(report => (
                              <li key={report.id} className="text-[11px]">
                                <p className="text-slate-200">{report.title}</p>
                                <p className="font-mono text-[10px] text-slate-500">
                                  hash {report.reportHash?.slice(0, 16) || '—'} ·{' '}
                                  {report.txHash
                                    ? `tx ${report.txHash.slice(0, 14)}… block ${report.blockNumber ?? '?'}`
                                    : 'NOT ANCHORED ON-CHAIN'}
                                  {' · '}
                                  {report.chainValid === false ? 'CHAIN INVALID' : 'CHAIN VALID'}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </ResourceGate>
  );
};

export default React.memo(IncidentsSection);
