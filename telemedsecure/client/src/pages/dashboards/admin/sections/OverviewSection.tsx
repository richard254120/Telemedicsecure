/**
 * Platform Overview.
 *
 * Every figure on this panel is now read from GET /admin/stats or
 * GET /integrity/verify. The previous version hard-coded companion values
 * next to them (`100% PASS`, `OPERATIONAL`, `BLOCK #4192`, `48h 12m (99.99%)`,
 * `DICOM 3.0`), so a backend that returned nothing still looked like a
 * flawless hospital. Unreported values render as "Not reported".
 */
import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Blocks,
  Clock,
  Database,
  DollarSign,
  FileCheck2,
  HeartPulse,
  Microscope,
  MonitorCheck,
  Server,
  ShieldAlert,
  Stethoscope,
  Users,
} from 'lucide-react';
import ChartBlock from '../components/ChartBlock';
import type { ChartDatum } from '../components/ChartBlock';
import {
  Badge,
  EmptyState,
  Metric,
  Panel,
  ResourceGate,
  SkeletonGrid,
} from '../components/ui';
import type { ResourceState } from '../hooks/useAdminData';
import type { ChainVerificationReport, SystemStats } from '../types';
import {
  UNREPORTED,
  formatCount,
  formatCurrency,
  formatPercent,
  formatUptime,
} from '../lib/format';

const ROLE_LABELS: Record<string, string> = {
  DOCTOR: 'Physicians',
  NURSE: 'Nurses',
  PATIENT: 'Patients',
  RADIOLOGIST: 'Radiologists',
  LAB_TECHNICIAN: 'Lab Techs',
  PHARMACIST: 'Pharmacists',
  BILLING_OFFICER: 'Billing',
  TRIAGE_OFFICER: 'Triage',
  CARE_COORDINATOR: 'Care Coord.',
  RECEPTIONIST: 'Reception',
  ADMIN: 'Admins',
};

interface OverviewSectionProps {
  stats: ResourceState;
  chain: ResourceState;
  onRetry: () => void;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ stats, chain, onRetry }) => {
  const data = stats.data as SystemStats | null;
  const report = chain.data as ChainVerificationReport | null;

  const workforceSeries = useMemo<ChartDatum[]>(() => {
    const roles = data?.overview?.roles;
    if (!roles) return [];
    return Object.entries(roles)
      .filter(([, count]) => count > 0)
      .map(([role, count]) => ({ name: ROLE_LABELS[role] ?? role, value: count }));
  }, [data]);

  const activitySeries = useMemo<ChartDatum[]>(() => {
    if (!data) return [];
    return [
      { name: 'Consults', value: data.clinical?.totalConsultations ?? 0, color: '#3b82f6' },
      { name: 'PACS', value: data.diagnostics?.radiology?.total ?? 0, color: '#8b5cf6' },
      { name: 'Labs', value: data.diagnostics?.lab?.total ?? 0, color: '#f59e0b' },
      { name: 'Triage', value: data.diagnostics?.triage?.total ?? 0, color: '#10b981' },
      { name: 'Rx', value: data.prescriptions?.totalPrescriptions ?? 0, color: '#06b6d4' },
      { name: 'Claims', value: data.financial?.totalClaims ?? 0, color: '#ec4899' },
    ];
  }, [data]);

  return (
    <ResourceGate resources={[stats]} onRetry={onRetry} skeleton={<div className="space-y-6"><SkeletonGrid cards={4} /><SkeletonGrid cards={4} /></div>}>
      {/* Operational status strip */}
      <section className="rounded-2xl border border-slate-700/70 bg-slate-800/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Live platform posture</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Measurements are taken from the API snapshot in this session, not from a static template.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {chain.status === 'loading' || chain.status === 'idle' ? (
              <Badge tone="neutral"><Clock className="h-3 w-3" /> VERIFYING CHAIN…</Badge>
            ) : chain.status === 'error' ? (
              <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> CHAIN CHECK UNAVAILABLE</Badge>
            ) : report?.isValid ? (
              <Badge tone="success"><Blocks className="h-3 w-3" /> HASH CHAIN VALID</Badge>
            ) : (
              <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> CHAIN {report?.status ?? 'UNKNOWN'}</Badge>
            )}
            <Badge tone={data?.system?.environment === 'production' ? 'info' : 'neutral'}>
              ENV: {data?.system?.environment ?? UNREPORTED}
            </Badge>
            <Badge tone="purple">{data?.system?.nodeVersion ?? UNREPORTED}</Badge>
          </div>
        </div>

        {report && !report.isValid && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-200">
            <p className="font-bold">Audit chain integrity failure</p>
            <p className="mt-1 text-slate-300">
              {report.brokenEvent
                ? `Break detected at event ${report.brokenEvent.index} (${report.brokenEvent.action} on ${report.brokenEvent.resource}): ${report.brokenEvent.reason}`
                : 'On-chain Merkle root verification did not match the local chain.'}
            </p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="DB round trip" value={data ? `${formatCount(data.system?.dbLatencyMs)} ms` : UNREPORTED} tone="info" hint="PostgreSQL aggregate query" />
          <Metric label="Uptime" value={formatUptime(data?.system?.uptimeSeconds)} tone="success" hint="API process" />
          <Metric label="Memory RSS" value={data ? `${formatCount(data.system?.memoryRssMb)} MB` : UNREPORTED} tone="purple" hint={`Heap ${formatCount(data?.system?.memoryHeapUsedMb)} MB`} />
          <Metric label="Chained audit events" value={data?.security?.auditEventsCount} tone="info" hint="SHA-256 linked" />
          <Metric label="Anchors verified" value={report ? `${report.anchorsChecked ?? 0}` : UNREPORTED} tone="success" hint={report?.onChainVerified ? 'On-chain match OK' : 'Not on-chain verified'} />
          <Metric label="Active accounts" value={data?.overview?.activeUsers} tone="success" hint={`${formatCount(data?.overview?.lockedUsers)} locked`} />
        </div>
      </section>

      {/* Clinical / financial KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Clinical consultations" icon={Stethoscope} description="WebRTC E2EE telehealth sessions">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Total" value={data?.clinical?.totalConsultations} tone="info" />
            <Metric label="Completion" value={formatPercent(data?.clinical?.completionRate)} tone="success" />
            <Metric label="In progress" value={data?.clinical?.inProgressConsultations} />
            <Metric label="Scheduled" value={data?.clinical?.scheduledConsultations} />
          </div>
        </Panel>

        <Panel title="Diagnostics throughput" icon={Microscope} description="PACS imaging, lab orders and triage intake">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="PACS studies" value={data?.diagnostics?.radiology?.total} tone="purple" hint={`${formatCount(data?.diagnostics?.radiology?.completed)} finalized`} />
            <Metric label="Urgent imaging" value={data?.diagnostics?.radiology?.urgent} tone="danger" />
            <Metric label="Lab orders" value={data?.diagnostics?.lab?.total} tone="warning" hint={`${formatCount(data?.diagnostics?.lab?.completed)} completed`} />
            <Metric label="Critical labs" value={data?.diagnostics?.lab?.critical} tone="danger" />
          </div>
        </Panel>

        <Panel title="EPCS prescriptions" icon={FileCheck2} description="DEA Schedule II–V digital signing">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Issued" value={data?.prescriptions?.totalPrescriptions} tone="info" />
            <Metric label="Signed" value={formatPercent(data?.prescriptions?.signatureRate)} tone="success" hint={`${formatCount(data?.prescriptions?.signedCount)} signatures`} />
            <Metric label="Dispensed" value={data?.prescriptions?.dispensed} />
            <Metric label="Revoked" value={data?.prescriptions?.revoked} tone="danger" />
          </div>
        </Panel>

        <Panel title="Revenue position" icon={DollarSign} description="Invoices and insurance claims">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Collected" value={formatCurrency(data?.financial?.totalCollected)} tone="success" />
            <Metric label="Billed" value={formatCurrency(data?.financial?.totalBilled)} />
            <Metric label="Patient due" value={formatCurrency(data?.financial?.totalPatientOutstanding)} tone="warning" />
            <Metric label="Claim approval" value={formatPercent(data?.financial?.claimApprovalRate)} tone="info" hint={`${formatCount(data?.financial?.approvedClaims)} of ${formatCount(data?.financial?.totalClaims)}`} />
          </div>
        </Panel>

        <Panel title="Security & compliance load" icon={ShieldAlert} description="Rules engine output">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Unresolved violations" value={data?.security?.unresolvedViolations} tone="warning" />
            <Metric label="Critical violations" value={data?.security?.criticalViolations} tone="danger" />
            <Metric label="Open alerts" value={data?.security?.alertsCount} tone="purple" />
            <Metric label="Open incidents" value={data?.security?.openIncidents} tone="danger" />
          </div>
        </Panel>

        <Panel title="Workforce & onboarding" icon={Users} description="Licensed staff and pending invitations">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Total accounts" value={data?.overview?.totalUsers} tone="info" />
            <Metric label="Physicians" value={data?.overview?.roles?.DOCTOR} tone="success" />
            <Metric label="Invitations issued" value={data?.security?.invitationsCount} />
            <Metric label="Invitations live" value={data?.security?.activeInvitationsCount} tone="warning" />
          </div>
        </Panel>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Cross-department volume"
          icon={Database}
          description="Record counts per clinical workstation"
          actions={<Badge tone="neutral">FROM /ADMIN/STATS</Badge>}
        >
          <ChartBlock variant="bar" data={activitySeries} height={280} emptyLabel="No clinical activity recorded yet" />
        </Panel>

        <Panel
          title="Account distribution"
          icon={Server}
          description="Every identity registered in the platform"
          actions={<Badge tone="neutral">{formatCount(data?.overview?.totalUsers)} TOTAL</Badge>}
        >
          <ChartBlock variant="donut" data={workforceSeries} height={280} emptyLabel="No accounts provisioned yet" />
        </Panel>
      </div>

      {!data && (
        <EmptyState
          icon={Activity}
          title="Aggregated metrics are unavailable"
          description="The statistics endpoint did not respond. Use Refresh to retry."
        />
      )}

      {/* Station matrix */}
      <Panel title="Specialised workstations" icon={MonitorCheck} description="Per-station activity from the same snapshot">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StationTile
            label="Physician suite"
            icon={Stethoscope}
            value={formatCount(data?.overview?.roles?.DOCTOR)}
            caption={`${formatCount(data?.clinical?.inProgressConsultations)} live calls · ${formatCount(data?.prescriptions?.signedCount)} Rx signed`}
            tone="text-blue-300"
          />
          <StationTile
            label="Nursing & triage"
            icon={HeartPulse}
            value={formatCount(data?.diagnostics?.triage?.total)}
            caption={`Average acuity ESI ${data?.diagnostics?.triage?.avgEsiScore ?? UNREPORTED}`}
            tone="text-emerald-300"
          />
          <StationTile
            label="Teleradiology PACS"
            icon={MonitorCheck}
            value={formatCount(data?.diagnostics?.radiology?.total)}
            caption={`${formatCount(data?.diagnostics?.radiology?.completed)} finalized · ${formatCount(data?.diagnostics?.radiology?.urgent)} urgent`}
            tone="text-purple-300"
          />
          <StationTile
            label="Clinical pathology"
            icon={Microscope}
            value={formatCount(data?.diagnostics?.lab?.total)}
            caption={`${formatCount(data?.diagnostics?.lab?.critical)} critical flags`}
            tone="text-amber-300"
          />
        </div>
      </Panel>
    </ResourceGate>
  );
};

const StationTile = React.memo(function StationTile({
  label,
  icon: Icon,
  value,
  caption,
  tone,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  caption: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 text-xs font-bold ${tone}`}>
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
      </div>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{caption}</p>
    </div>
  );
});

export default React.memo(OverviewSection);
