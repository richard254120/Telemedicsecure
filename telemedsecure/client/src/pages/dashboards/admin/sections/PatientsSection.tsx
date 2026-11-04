/**
 * Patient Registry.
 *
 * Identity lifecycle only. Administrators deliberately get no clinical surface
 * here: the roster endpoint exposes names, contact, account state and 2FA
 * status, and that is exactly what this panel renders. The role-boundary notice
 * is kept because it documents a real server-side `requireRole` boundary, not a
 * decorative compliance badge.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Ban,
  Download,
  KeyRound,
  Search,
  ShieldAlert,
  Trash2,
  User,
  UserCheck,
} from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmModal,
  EmptyState,
  INPUT_CLASS,
  Metric,
  Modal,
  Pagination,
  Panel,
  ResourceGate,
  SecretField,
  SkeletonRows,
} from '../components/ui';
import { selectRows, type ResourceState } from '../hooks/useAdminData';
import type { AdminActions } from '../hooks/useAdminActions';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useNow } from '../hooks/useNow';
import { usePagedRows } from '../hooks/usePagedRows';
import { csvFileName, downloadCsv, toCsv } from '../lib/csv';
import { formatDateTime, fullName, initialsOf } from '../lib/format';
import type { AdminUser } from '../types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface PatientsSectionProps {
  users: ResourceState;
  actions: AdminActions;
  onRetry: () => void;
}

const PatientsSection: React.FC<PatientsSectionProps> = ({ users, actions, onRetry }) => {
  const all = selectRows<AdminUser>(users);
  const pending = actions.pending;

  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'NO_2FA'>('ALL');
  const [purgeTargets, setPurgeTargets] = useState<AdminUser[] | null>(null);
  const [totpResult, setTotpResult] = useState<{ name: string; secret: string } | null>(null);

  const patients = useMemo(() => all.filter(person => person.role === 'PATIENT'), [all]);
  const debouncedQuery = useDebouncedValue(query, 200);
  // Committed clock tick; render-phase Date.now() would make ages and lockout
  // badges shift whenever React re-renders for an unrelated reason.
  const now = useNow(30_000);

  const metrics = useMemo(() => {
    let active = 0;
    let enrolled2fa = 0;
    let recent = 0;
    patients.forEach(person => {
      if (person.isActive) active += 1;
      if (person.isTotpEnabled) enrolled2fa += 1;
      if (now - new Date(person.createdAt).getTime() < THIRTY_DAYS_MS) recent += 1;
    });
    return { total: patients.length, active, suspended: patients.length - active, enrolled2fa, recent };
  }, [patients, now]);

  const filtered = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return patients.filter(person => {
      if (stateFilter === 'ACTIVE' && !person.isActive) return false;
      if (stateFilter === 'SUSPENDED' && person.isActive) return false;
      if (stateFilter === 'NO_2FA' && person.isTotpEnabled) return false;
      if (!needle) return true;
      return (
        `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim().toLowerCase().includes(needle)
        || person.email?.toLowerCase().includes(needle)
        || person.id.toLowerCase().includes(needle)
      );
    });
  }, [patients, debouncedQuery, stateFilter]);

  const { page, visible, setPage, total } = usePagedRows(filtered, 15);

  const exportRegistry = useCallback(() => {
    const csv = toCsv(
      ['Record id', 'Name', 'Email', 'Account state', '2FA', 'Registered', 'Locked until'],
      filtered.map(person => [
        person.id,
        fullName(person),
        person.email,
        person.isActive ? 'ACTIVE' : 'SUSPENDED',
        person.isTotpEnabled ? 'TOTP ENROLLED' : 'PASSWORD ONLY',
        person.createdAt,
        person.lockedUntil ?? '',
      ]),
    );
    downloadCsv(csvFileName('patient-registry'), csv);
  }, [filtered]);

  const reissueTotp = useCallback(
    async (person: AdminUser) => {
      const result = await actions.resetTotp(person.id, fullName(person));
      const secret = (result.data as { secret?: string } | undefined)?.secret;
      if (result.ok && secret) setTotpResult({ name: fullName(person), secret });
    },
    [actions],
  );

  const confirmPurge = useCallback(async () => {
    if (!purgeTargets) return;
    const result = await actions.purgeUsers(purgeTargets.map(person => person.id), 'patient record(s)');
    if (result.ok) setPurgeTargets(null);
  }, [actions, purgeTargets]);

  return (
    <ResourceGate
      resources={[users]}
      onRetry={onRetry}
      skeleton={<div className="space-y-6"><SkeletonRows rows={3} /><SkeletonRows rows={8} /></div>}
    >
      <Panel
        title="Patient population registry"
        icon={User}
        description="Identity lifecycle and authentication posture for enrolled patients."
        actions={<Badge tone="info">{metrics.total.toLocaleString()} ENROLLED</Badge>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Enrolled patients" value={metrics.total} tone="info" />
          <Metric label="Active" value={metrics.active} tone="success" />
          <Metric label="Suspended" value={metrics.suspended} tone={metrics.suspended ? 'warning' : 'neutral'} />
          <Metric label="2FA enrolled" value={metrics.enrolled2fa} tone="purple" hint={metrics.total ? `${Math.round((metrics.enrolled2fa / metrics.total) * 100)}% of population` : 'no patients yet'} />
          <Metric label="Joined (30 days)" value={metrics.recent} tone="info" />
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-[11px] leading-relaxed text-slate-300">
            <strong className="text-amber-300">HIPAA §164.312 role boundary.</strong> Administrator tokens are
            rejected by the clinical routers: prescriptions, consultations and EHR writes require a credentialed
            physician or triage nurse. This panel therefore exposes account governance only, never diagnoses,
            imaging or notes.
          </p>
        </div>
      </Panel>

      <Panel
        title="Enrolled patient directory"
        icon={User}
        description={`Showing ${Math.min(filtered.length, 15)} of ${filtered.length} matching record(s), newest registrations first.`}
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search name, email or record id"
                aria-label="Search patients"
                className={`${INPUT_CLASS} w-60 pl-8`}
              />
            </div>
            <select
              value={stateFilter}
              onChange={event => setStateFilter(event.target.value as typeof stateFilter)}
              aria-label="Filter patient state"
              className={`${INPUT_CLASS} w-40`}
            >
              <option value="ALL">All records</option>
              <option value="ACTIVE">Active only</option>
              <option value="SUSPENDED">Suspended only</option>
              <option value="NO_2FA">No 2FA enrolled</option>
            </select>
            <Button variant="secondary" icon={Download} onClick={exportRegistry} disabled={filtered.length === 0}>
              Export
            </Button>
          </>
        }
        bodyClassName="p-0"
      >
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={User}
              title={patients.length === 0 ? 'No patients have registered yet' : 'No patient matches these filters'}
              description={
                patients.length === 0
                  ? 'The registry is genuinely empty in this environment. Self-registration creates the first record.'
                  : 'Adjust the search term or state filter to widen the result set.'
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-xs">
                <thead className="bg-slate-900/70 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Patient</th>
                    <th scope="col" className="px-3 py-3">Record id</th>
                    <th scope="col" className="px-3 py-3">Authentication</th>
                    <th scope="col" className="px-3 py-3">Account</th>
                    <th scope="col" className="px-3 py-3">Registered</th>
                    <th scope="col" className="px-5 py-3 text-right">Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visible.map(person => (
                    <tr key={person.id} className="align-top hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-bold text-cyan-200">
                            {initialsOf(person.firstName, person.lastName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-100">{fullName(person)}</p>
                            <p className="truncate font-mono text-[10px] text-slate-500">{person.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded bg-slate-900 px-2 py-1 font-mono text-[10px] text-cyan-300">
                          UID-{person.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={person.isTotpEnabled ? 'success' : 'neutral'}>
                          {person.isTotpEnabled ? 'TOTP ACTIVE' : 'PASSWORD ONLY'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={person.isActive ? 'success' : 'danger'}>
                            {person.isActive ? 'ACTIVE' : 'SUSPENDED'}
                          </Badge>
                          {person.lockedUntil && new Date(person.lockedUntil).getTime() > now && (
                            <Badge tone="warning">LOCKED</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-400">{formatDateTime(person.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            variant={person.isActive ? 'ghost' : 'success'}
                            icon={person.isActive ? Ban : UserCheck}
                            busy={pending === `status:${person.id}`}
                            onClick={() => void actions.setActive(person.id, !person.isActive, fullName(person))}
                          >
                            {person.isActive ? 'Suspend' : 'Activate'}
                          </Button>
                          <Button
                            variant="ghost"
                            icon={KeyRound}
                            busy={pending === `totp:${person.id}`}
                            title="Re-issue a 2FA enrolment secret"
                            onClick={() => void reissueTotp(person)}
                          >
                            2FA
                          </Button>
                          <Button variant="danger" icon={Trash2} onClick={() => setPurgeTargets([person])}>
                            Purge
                          </Button>
                        </div>
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

      <ConfirmModal
        open={!!purgeTargets}
        title="Purge patient record"
        description="Deletes the identity together with its consultations, prescriptions, invoices and imaging links. Protected health information cannot be recovered afterwards."
        confirmPhrase="PURGE"
        phraseHint="Type PURGE to confirm the irreversible deletion"
        busy={pending?.startsWith('purge:') ?? false}
        onConfirm={confirmPurge}
        onClose={() => setPurgeTargets(null)}
      >
        <p className="text-xs text-slate-300">
          Target: <strong className="text-white">{fullName(purgeTargets?.[0] ?? {})}</strong>
        </p>
        <p className="text-[11px] text-slate-400">
          If the patient requested account closure, confirm their retention obligation for billing and prescription
          records is satisfied before purging.
        </p>
      </ConfirmModal>

      <Modal
        open={!!totpResult}
        onClose={() => setTotpResult(null)}
        title="New 2FA enrolment secret"
        description="Send this to the patient through a channel separate from email. It is displayed once."
        icon={KeyRound}
        tone="warning"
        footer={<Button variant="primary" onClick={() => setTotpResult(null)}>Done — secret delivered</Button>}
      >
        <p className="text-xs text-slate-300">{totpResult?.name} must re-enrol in their authenticator app.</p>
        {totpResult && <SecretField label="Base32 secret" value={totpResult.secret} />}
      </Modal>
    </ResourceGate>
  );
};

export default React.memo(PatientsSection);
