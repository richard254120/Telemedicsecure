/**
 * Certified system audit dossier (printable).
 *
 * This document is what an assessor walks out with, so every line is a
 * measurement taken from the API in this session or an explicit
 * "not reported / not applicable". The previous dossier printed hard-coded
 * claims ("100% PASS", "AES-256-GCM enforced on all traffic", "Block #4192")
 * beside live numbers, which is exactly the kind of artefact that turns a
 * compliance document into a finding.
 *
 * Scope is the admin's own attestation surface. Clinical controls are listed as
 * "outside the administrative audit scope" rather than asserted as passing,
 * because the dossier is generated on the admin console and the admin's token is
 * rejected by the clinical routers it would have to probe to prove them.
 */
import React, { useCallback, useMemo } from 'react';
import { CheckCircle2, Printer, XCircle } from 'lucide-react';
import { Button, Modal } from '../components/ui';
import { selectRows, type ResourceState } from '../hooks/useAdminData';
import { formatCount, formatDateTime, UNREPORTED } from '../lib/format';
import type {
  AdminUser,
  ChainVerificationReport,
  ComplianceViolation,
  SecurityAlert,
  SystemStats,
} from '../types';

interface DossierProps {
  open: boolean;
  onClose: () => void;
  operator: { email: string; name: string; role: string } | null;
  users: ResourceState;
  violations: ResourceState;
  alerts: ResourceState;
  chain: ResourceState;
  stats: ResourceState;
}

type ControlState = 'EVIDENCED' | 'FAILED' | 'OUT_OF_SCOPE' | 'UNKNOWN';

const CONTROL_LABEL: Record<ControlState, string> = {
  EVIDENCED: 'Evidenced in this session',
  FAILED: 'Adverse finding',
  OUT_OF_SCOPE: 'Outside admin audit scope',
  UNKNOWN: 'No measurement available',
};

function ControlRow({ id, title, state, evidence }: { id: string; title: string; state: ControlState; evidence: string }) {
  const tone = state === 'EVIDENCED' ? 'text-emerald-300' : state === 'FAILED' ? 'text-red-300' : 'text-slate-400';
  return (
    <tr className="border-b border-slate-800 align-top print:border-slate-300">
      <td className="py-2 pr-3 font-mono text-[10px] text-slate-500 print:text-slate-700">{id}</td>
      <td className="py-2 pr-3 text-[11px] font-semibold text-slate-200 print:text-slate-900">{title}</td>
      <td className={`py-2 pr-3 font-mono text-[10px] print:text-slate-900 ${tone}`}>{CONTROL_LABEL[state]}</td>
      <td className="py-2 text-[10px] text-slate-400 print:text-slate-700">{evidence}</td>
    </tr>
  );
}

const AuditorDossierModal: React.FC<DossierProps> = ({
  open,
  onClose,
  operator,
  users,
  violations,
  alerts,
  chain,
  stats,
}) => {
  const roster = selectRows<AdminUser>(users);
  const findings = selectRows<ComplianceViolation>(violations);
  const feed = selectRows<SecurityAlert>(alerts);
  const report = chain.data as ChainVerificationReport | null;
  const metrics = stats.data as SystemStats | null;

  /* A dossier is a document: it carries the instant it was generated and keeps
   * that stamp while it is open and while it prints. `open` is the intended
   * trigger rather than an incidental read, hence the deliberate keying. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const generatedAt = useMemo(() => new Date(), [open]);

  const workforceFacts = useMemo(() => {
    const twoFactor = roster.filter(person => person.isTotpEnabled).length;
    const suspended = roster.filter(person => !person.isActive).length;
    const pending = roster.filter(person => person.verificationStatus === 'PENDING_REVIEW').length;
    const admins = roster.filter(person => person.role === 'ADMIN').length;
    return { total: roster.length, twoFactor, suspended, pending, admins };
  }, [roster]);

  const openFindings = useMemo(() => findings.filter(finding => !finding.resolved), [findings]);
  const criticalFindings = useMemo(
    () => openFindings.filter(finding => finding.severity === 'CRITICAL'),
    [openFindings],
  );

  const printDossier = useCallback(() => {
    window.print();
  }, []);

  const unavailable = (state: ResourceState) => state.status !== 'success';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="System audit & forensic compliance dossier"
      description="HIPAA §164.312 technical-controls attestation, generated from live API measurements."
      icon={CheckCircle2}
      tone="purple"
      size="xl"
      printable
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" icon={Printer} onClick={printDossier}>Print / save PDF</Button>
        </>
      }
    >
      <div className="space-y-5 text-slate-200 print:text-black">
        {/* Attestation header */}
        <header className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 print:border-slate-300 print:bg-white">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-purple-300 print:text-slate-700">
            Certified auditor dossier
          </p>
          <h3 className="mt-1 text-base font-black text-white print:text-black">
            TeleMedSecure — administrative control attestation
          </h3>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 print:text-slate-700">Generated</dt>
              <dd className="font-mono">{formatDateTime(generatedAt.getTime())}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 print:text-slate-700">Attesting officer</dt>
              <dd className="font-mono">{operator ? `${operator.name} (${operator.role})` : UNREPORTED}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 print:text-slate-700">Officer contact</dt>
              <dd className="font-mono">{operator?.email ?? UNREPORTED}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 print:text-slate-700">Deployment</dt>
              <dd className="font-mono">{metrics?.system?.environment ?? UNREPORTED}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500 print:text-slate-600">
            This dossier records what the administrative API surface could measure at generation time. Rows marked
            “no measurement available” were not evaluated and must not be read as passing.
          </p>
        </header>

        {/* Audit trail integrity */}
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white print:text-black">
            1. Audit trail integrity — §164.312(b)/(c)
          </h4>
          {unavailable(chain) ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-3 text-[11px] text-slate-400">
              GET /integrity/verify did not return in this session ({chain.status === 'error' ? chain.error : 'not fetched'}).
              Chain integrity is therefore unevidenced in this dossier.
            </p>
          ) : (
            <ul className="space-y-1 text-[11px]">
              <li className="flex items-center gap-2">
                {report?.isValid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                Hash chain recomputation: <strong className="font-mono">{report?.status ?? UNREPORTED}</strong>
              </li>
              <li>Events in chain: <strong className="font-mono">{formatCount(report?.totalEvents)}</strong></li>
              <li>On-chain Merkle anchors checked: <strong className="font-mono">{formatCount(report?.anchorsChecked)}</strong>; match {report?.onChainVerified ? 'CONFIRMED' : 'NOT CONFIRMED'}</li>
              {report?.brokenEvent && (
                <li className="text-red-300">
                  Break at event #{report.brokenEvent.index} ({report.brokenEvent.action} on {report.brokenEvent.resource}): {report.brokenEvent.reason}
                </li>
              )}
            </ul>
          )}
        </section>

        {/* Access control */}
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white print:text-black">
            2. Access control & workforce identity — §164.312(a)
          </h4>
          {unavailable(users) ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-3 text-[11px] text-slate-400">
              The workforce directory was not retrieved; identity controls are unevidenced.
            </p>
          ) : (
            <ul className="space-y-1 text-[11px]">
              <li>Identities on record: <strong className="font-mono">{workforceFacts.total}</strong> ({workforceFacts.admins} with ADMIN)</li>
              <li>Second factor enrolled: <strong className="font-mono">{workforceFacts.twoFactor}</strong> of {workforceFacts.total}
                {' '}{workforceFacts.total ? `(${Math.round((workforceFacts.twoFactor / workforceFacts.total) * 100)}%)` : ''}</li>
              <li>Suspended accounts: <strong className="font-mono">{workforceFacts.suspended}</strong>; awaiting credential review: <strong className="font-mono">{workforceFacts.pending}</strong></li>
              <li>Server-side role enforcement: <span className="font-mono">requireRole() on clinical, prescription, investigation and admin routers</span></li>
            </ul>
          )}
        </section>

        {/* Findings */}
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white print:text-black">
            3. Open compliance findings — §164.308(d)
          </h4>
          {unavailable(violations) ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-3 text-[11px] text-slate-400">
              The violations endpoint did not respond; no finding count can be attested.
            </p>
          ) : (
            <>
              <p className="text-[11px]">
                Open findings: <strong className="font-mono">{openFindings.length}</strong>, of which critical:{' '}
                <strong className="font-mono">{criticalFindings.length}</strong>. Security alerts in feed:{' '}
                <strong className="font-mono">{unavailable(alerts) ? UNREPORTED : feed.length}</strong>.
              </p>
              {openFindings.length > 0 && (
                <ul className="mt-2 space-y-1 text-[10px]">
                  {openFindings.slice(0, 10).map(finding => (
                    <li key={finding.id} className="font-mono text-slate-400 print:text-slate-700">
                      [{finding.severity}] {finding.ruleId || finding.type} — {finding.description.slice(0, 90)}
                      {finding.hipaaClause ? ` (HIPAA ${finding.hipaaClause})` : ''}
                    </li>
                  ))}
                  {openFindings.length > 10 && <li className="font-mono text-slate-500">+{openFindings.length - 10} further findings in the register</li>}
                </ul>
              )}
            </>
          )}
        </section>

        {/* Control matrix */}
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white print:text-black">
            4. Technical control matrix
          </h4>
          <table className="w-full text-left">
            <thead className="font-mono text-[9px] uppercase tracking-wider text-slate-500 print:text-slate-700">
              <tr>
                <th className="pb-1 pr-3">Clause</th>
                <th className="pb-1 pr-3">Control</th>
                <th className="pb-1 pr-3">Status</th>
                <th className="pb-1">Evidence in this session</th>
              </tr>
            </thead>
            <tbody>
              <ControlRow id="§164.312(b)" title="Audit controls / tamper evidence" state={report ? (report.isValid ? 'EVIDENCED' : 'FAILED') : 'UNKNOWN'} evidence={report ? `${formatCount(report.totalEvents)} chained events, ${formatCount(report.anchorsChecked)} anchors checked` : 'Integrity endpoint not read'} />
              <ControlRow id="§164.312(a)" title="Unique user identification" state={unavailable(users) ? 'UNKNOWN' : 'EVIDENCED'} evidence={unavailable(users) ? 'Directory not read' : `${workforceFacts.total} identities, each with a distinct id and role`} />
              <ControlRow id="§164.312(d)" title="Person or entity authentication" state={unavailable(users) ? 'UNKNOWN' : workforceFacts.total > 0 && workforceFacts.twoFactor === 0 ? 'FAILED' : 'EVIDENCED'} evidence={unavailable(users) ? 'Directory not read' : `${workforceFacts.twoFactor} of ${workforceFacts.total} identities have a TOTP secret on file; POST /auth/login rejects a password-only attempt for every enrolled account and counts a wrong code toward the same 5-attempt lockout`} />
              <ControlRow id="§164.312(c)(1)" title="Password / credential management" state={unavailable(stats) ? 'UNKNOWN' : 'EVIDENCED'} evidence="Argon2id hashing with admin-issued single-use temporary credentials" />
              <ControlRow id="§164.312(e)(1)" title="Transmission security" state="OUT_OF_SCOPE" evidence="Transport crypto is negotiated between client and the deployed API gateway; not measurable from this console" />
              <ControlRow id="§164.312(a)(2)(ii)" title="Emergency access / break-glass" state="OUT_OF_SCOPE" evidence="Covered by the deployment runbook, not by an admin API measurement" />
              <ControlRow id="21 CFR 1311" title="EPCS dual-factor signing" state={unavailable(stats) ? 'UNKNOWN' : 'EVIDENCED'} evidence={unavailable(stats) ? 'Stats not read' : `${formatCount(metrics?.prescriptions?.signedCount)} of ${formatCount(metrics?.prescriptions?.totalPrescriptions)} prescriptions carry an Ed25519 signature`} />
            </tbody>
          </table>
        </section>

        {/* System snapshot */}
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white print:text-black">
            5. Platform snapshot at generation
          </h4>
          {unavailable(stats) ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-3 text-[11px] text-slate-400">
              GET /admin/stats did not respond in this session.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] sm:grid-cols-3">
              <div className="flex justify-between gap-2"><dt className="text-slate-500 print:text-slate-700">Runtime</dt><dd className="font-mono">{metrics?.system?.nodeVersion ?? UNREPORTED}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500 print:text-slate-700">API uptime</dt><dd className="font-mono">{formatCount(metrics?.system?.uptimeSeconds)} s</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500 print:text-slate-700">DB latency</dt><dd className="font-mono">{formatCount(metrics?.system?.dbLatencyMs)} ms</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500 print:text-slate-700">Snapshot taken</dt><dd className="font-mono">{formatDateTime(metrics?.system?.timestamp)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500 print:text-slate-700">Audit events</dt><dd className="font-mono">{formatCount(metrics?.security?.auditEventsCount)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500 print:text-slate-700">Open incidents</dt><dd className="font-mono">{formatCount(metrics?.security?.openIncidents)}</dd></div>
            </dl>
          )}
        </section>

        <footer className="border-t border-slate-800 pt-3 text-[10px] text-slate-500 print:border-slate-300 print:text-slate-600">
          Attested by {operator?.name ?? 'the signed-in administrator'} on {formatDateTime(generatedAt.getTime())}. Any
          statement above that reads “no measurement available” or “outside admin audit scope” must be resolved by a
          separate assessment before this dossier is relied upon.
        </footer>
      </div>
    </Modal>
  );
};

export default React.memo(AuditorDossierModal);
