/**
 * EPCS prescription audit ledger.
 *
 * `signatureStatus` is computed server-side by re-hashing the canonical payload
 * and verifying the stored Ed25519 signature against the prescriber's public
 * key. Rows with no signature or no public key arrive as TAMPERED, so this panel
 * breaks out "no signature on file" separately — otherwise an unsigned draft
 * would be reported as forgery, which is a very different escalation.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileCheck2,
  FileSearch,
  Signature,
  Stethoscope,
  XOctagon,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
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
import { csvFileName, downloadCsv, toCsv } from '../lib/csv';
import { formatDateTime, fullName } from '../lib/format';
import type { PrescriptionAudit } from '../types';

type SignatureFilter = 'ALL' | 'VALID' | 'TAMPERED_SIGNED' | 'UNSIGNED';

interface PrescriptionsSectionProps {
  prescriptions: ResourceState;
  onRetry: () => void;
  onOpenDocument: (row: PrescriptionAudit) => void;
}

/** Distinguishes "signature fails to verify" from "nothing was ever signed". */
function classify(row: PrescriptionAudit): Exclude<SignatureFilter, 'ALL'> {
  if (!row.signature?.signature || !row.doctor?.doctorPublicKey) return 'UNSIGNED';
  return row.signatureStatus === 'VALID' ? 'VALID' : 'TAMPERED_SIGNED';
}

/** Colour a chained event by what it did, not by who did it. */
function eventTone(action: string): 'danger' | 'warning' | 'info' {
  if (/REVOK|DELETE|TAMPER|FAIL/i.test(action)) return 'danger';
  if (/EXPIRE|DISPENSE/i.test(action)) return 'warning';
  return 'info';
}

const CLASS_BADGE: Record<Exclude<SignatureFilter, 'ALL'>, { tone: 'success' | 'danger' | 'warning'; label: string }> = {
  VALID: { tone: 'success', label: 'SIGNATURE VALID' },
  TAMPERED_SIGNED: { tone: 'danger', label: 'SIGNATURE FAILED' },
  UNSIGNED: { tone: 'warning', label: 'NOT SIGNED' },
};

const PrescriptionsSection: React.FC<PrescriptionsSectionProps> = ({ prescriptions, onRetry, onOpenDocument }) => {
  const rows = selectRows<PrescriptionAudit>(prescriptions);

  const [query, setQuery] = useState('');
  const [signatureFilter, setSignatureFilter] = useState<SignatureFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 200);

  const metrics = useMemo(() => {
    let valid = 0;
    let failed = 0;
    let unsigned = 0;
    let revoked = 0;
    let dispensed = 0;
    rows.forEach(row => {
      const kind = classify(row);
      if (kind === 'VALID') valid += 1;
      else if (kind === 'TAMPERED_SIGNED') failed += 1;
      else unsigned += 1;
      if (row.status === 'REVOKED') revoked += 1;
      if (row.status === 'DISPENSED') dispensed += 1;
    });
    return { total: rows.length, valid, failed, unsigned, revoked, dispensed };
  }, [rows]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(row => row.status && set.add(row.status));
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return rows.filter(row => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (signatureFilter !== 'ALL' && classify(row) !== signatureFilter) return false;
      if (!needle) return true;
      const haystack = [
        fullName(row.consultation?.patient ?? {}),
        row.consultation?.patient?.email,
        fullName(row.doctor ?? {}),
        row.doctor?.email,
        ...(row.items ?? []).map(item => `${item.medication} ${item.dosage}`),
        row.id,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, debouncedQuery, signatureFilter, statusFilter]);

  const { page, visible, setPage, total } = usePagedRows(filtered, 12);

  const exportLedger = useCallback(() => {
    const csv = toCsv(
      ['Rx id', 'Issued', 'Patient', 'Prescriber', 'Medications', 'Signature', 'Rx status', 'Audit events'],
      filtered.map(row => [
        row.id,
        row.createdAt,
        fullName(row.consultation?.patient ?? {}),
        fullName(row.doctor ?? {}),
        (row.items ?? []).map(item => `${item.medication} ${item.dosage}`).join('; '),
        classify(row) === 'VALID' ? 'VERIFIED' : classify(row) === 'TAMPERED_SIGNED' ? 'FAILED' : 'NONE',
        row.status,
        row.auditHistory?.length ?? 0,
      ]),
    );
    downloadCsv(csvFileName('epcs-audit-ledger'), csv);
  }, [filtered]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded(current => (current === id ? null : id));
  }, []);

  return (
    <ResourceGate
      resources={[prescriptions]}
      onRetry={onRetry}
      skeleton={<div className="space-y-6"><SkeletonGrid cards={4} /><SkeletonRows rows={8} /></div>}
    >
      <Panel
        title="Controlled-substance signature ledger"
        icon={FileCheck2}
        description="Every prescription in the network with its cryptographic verdict, recomputed on each read."
        actions={<Badge tone="neutral">{metrics.total.toLocaleString()} RECORDS</Badge>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Records" value={metrics.total} tone="info" />
          <Metric label="Signatures valid" value={metrics.valid} tone="success" />
          <Metric label="Signatures failed" value={metrics.failed} tone={metrics.failed ? 'danger' : 'neutral'} hint={metrics.failed ? 'Escalate to casework' : 'none detected'} />
          <Metric label="Unsigned" value={metrics.unsigned} tone={metrics.unsigned ? 'warning' : 'neutral'} hint="No signature row on file" />
          <Metric label="Dispensed" value={metrics.dispensed} tone="purple" />
          <Metric label="Revoked" value={metrics.revoked} tone={metrics.revoked ? 'danger' : 'neutral'} />
        </div>

        {metrics.failed > 0 && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-200">
            <XOctagon className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {metrics.failed} prescription{metrics.failed === 1 ? '' : 's'} failed Ed25519 verification. A failed
              signature means the stored payload no longer matches what was signed — treat these as potential
              tampering, not as data-entry noise.
            </p>
          </div>
        )}
      </Panel>

      <Panel
        title="Prescription audit registry"
        icon={Signature}
        description="Expand a row to read its hash-chained event trail."
        actions={
          <>
            <div className="relative">
              <FileSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search patient, prescriber, drug"
                aria-label="Search prescriptions"
                className={`${INPUT_CLASS} w-60 pl-8`}
              />
            </div>
            <select
              value={signatureFilter}
              onChange={event => setSignatureFilter(event.target.value as SignatureFilter)}
              aria-label="Filter by signature verdict"
              className={`${INPUT_CLASS} w-40`}
            >
              <option value="ALL">All verdicts</option>
              <option value="VALID">Verified only</option>
              <option value="TAMPERED_SIGNED">Failed only</option>
              <option value="UNSIGNED">Unsigned only</option>
            </select>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              aria-label="Filter by prescription status"
              className={`${INPUT_CLASS} w-36`}
            >
              <option value="ALL">All statuses</option>
              {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <Button variant="secondary" icon={Download} onClick={exportLedger} disabled={filtered.length === 0}>
              Export
            </Button>
          </>
        }
        bodyClassName="p-0"
      >
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={FileCheck2}
              title={rows.length === 0 ? 'No prescriptions have been issued' : 'No prescription matches these filters'}
              description={
                rows.length === 0
                  ? 'The EPCS ledger is empty in this environment. Nothing here has been suppressed or defaulted.'
                  : 'Widen the verdict or status filter to see more of the ledger.'
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="bg-slate-900/70 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="w-10 px-4 py-3" />
                    <th scope="col" className="px-3 py-3">Issued</th>
                    <th scope="col" className="px-3 py-3">Patient</th>
                    <th scope="col" className="px-3 py-3">Prescriber</th>
                    <th scope="col" className="px-3 py-3">Scheduled medications</th>
                    <th scope="col" className="px-3 py-3">Verdict</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-5 py-3 text-right">Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visible.map(row => {
                    const kind = classify(row);
                    const badge = CLASS_BADGE[kind];
                    const open = expanded === row.id;
                    const trail = row.auditHistory ?? [];
                    return (
                      <React.Fragment key={row.id}>
                        <tr className="align-top hover:bg-slate-800/40">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(row.id)}
                              aria-expanded={open}
                              aria-label={`Show audit trail for prescription ${row.id.slice(0, 8)}`}
                              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                            >
                              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          </td>
                          <td className="px-3 py-3 font-mono text-[11px] text-slate-400">{formatDateTime(row.createdAt)}</td>
                          <td className="px-3 py-3">
                            <p className="truncate font-semibold text-slate-100">{fullName(row.consultation?.patient ?? {})}</p>
                            <p className="truncate font-mono text-[10px] text-slate-500">{row.consultation?.patient?.email ?? '—'}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="truncate font-semibold text-slate-100">{fullName(row.doctor ?? {})}</p>
                            <p className="truncate font-mono text-[10px] text-slate-500">{row.doctor?.email ?? '—'}</p>
                          </td>
                          <td className="max-w-[260px] px-3 py-3">
                            {(row.items ?? []).length === 0 ? (
                              <span className="font-mono text-[10px] text-slate-500">NO MEDICATION LINES</span>
                            ) : (
                              <ul className="space-y-0.5">
                                {row.items!.map(item => (
                                  <li key={item.id} className="truncate text-[11px] text-slate-200">
                                    {item.medication} <span className="text-slate-500">· {item.dosage}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-3 py-3"><Badge tone={badge.tone}>{badge.label}</Badge></td>
                          <td className="px-3 py-3">
                            <Badge tone={row.status === 'REVOKED' ? 'danger' : row.status === 'DISPENSED' ? 'success' : 'neutral'}>
                              {row.status}
                            </Badge>
                            {row.statusReason && <p className="mt-0.5 text-[10px] text-slate-500">{row.statusReason}</p>}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button variant="secondary" icon={FileSearch} onClick={() => onOpenDocument(row)}>
                              Open
                            </Button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-900/50">
                            <td colSpan={8} className="px-6 py-4">
                              <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                                <Stethoscope className="h-3 w-3" />
                                Chained event trail ({trail.length})
                              </p>
                              {trail.length === 0 ? (
                                <p className="text-[11px] text-slate-500">
                                  No audit events reference this prescription resource.
                                </p>
                              ) : (
                                <ol className="space-y-1.5">
                                  {trail.map(event => (
                                    <li key={event.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                                      <span className="font-mono text-slate-500">{formatDateTime(event.timestamp)}</span>
                                      <Badge tone={eventTone(event.action)}>
                                        {event.action}
                                      </Badge>
                                      <span className="text-slate-300">{event.user?.email ?? 'system'}</span>
                                      {event.ipAddress && <span className="font-mono text-[10px] text-slate-500">{event.ipAddress}</span>}
                                    </li>
                                  ))}
                                </ol>
                              )}
                              <p className="mt-2 font-mono text-[10px] text-slate-500">
                                canonical sha256: {row.canonicalHash || 'NOT COMPUTED'}
                              </p>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={12} total={total} onPage={setPage} />
          </>
        )}
      </Panel>
    </ResourceGate>
  );
};

export default React.memo(PrescriptionsSection);
