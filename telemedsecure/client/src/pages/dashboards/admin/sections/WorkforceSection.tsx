/**
 * Workforce & RBAC.
 *
 * Capabilities are preserved from the monolith (credential queue, directory,
 * role reassignment, suspension, 2FA re-issue, deletion, invitations) but two
 * things changed deliberately:
 *
 *  - the 2FA column now reads `isTotpEnabled` from the server. The old code
 *    tested `user.totpSecret`, a field GET /admin/users never selected, so every
 *    row reported "NOT ENROLLED" no matter what the account had enrolled in;
 *  - the operator's own row cannot be deleted, demoted, or suspended. The
 *    previous table offered no guard, so a single misclick could lock an
 *    administrator out of the only account that could undo it.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  ChevronDown,
  Download,
  KeyRound,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
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
  SkeletonGrid,
  SkeletonRows,
} from '../components/ui';
import { selectRows, type ResourceState } from '../hooks/useAdminData';
import type { AdminActions } from '../hooks/useAdminActions';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useNow } from '../hooks/useNow';
import { usePagedRows } from '../hooks/usePagedRows';
import { csvFileName, downloadCsv, toCsv } from '../lib/csv';
import {
  formatDateTime,
  fullName,
  humanizeRole,
  initialsOf,
  roleAccent,
  verificationTone,
} from '../lib/format';
import { PROVISIONABLE_ROLES } from '../types';
import type { AdminUser, StaffInvitation } from '../types';

type DirectoryFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'PENDING_CREDENTIALS';

const FILTERS: { id: DirectoryFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING_CREDENTIALS', label: 'Awaiting review' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'SUSPENDED', label: 'Suspended' },
  { id: 'LOCKED', label: 'Locked out' },
];

interface WorkforceSectionProps {
  users: ResourceState;
  invitations: ResourceState;
  actions: AdminActions;
  operatorId: string;
  onRetry: () => void;
  onOpenProvision: () => void;
}

const WorkforceSection: React.FC<WorkforceSectionProps> = ({
  users,
  invitations,
  actions,
  operatorId,
  onRetry,
  onOpenProvision,
}) => {
  const roster = selectRows<AdminUser>(users);
  const invites = selectRows<StaffInvitation>(invitations);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [purgeTargets, setPurgeTargets] = useState<AdminUser[] | null>(null);
  const [totpResult, setTotpResult] = useState<{ name: string; secret: string } | null>(null);

  const debouncedQuery = useDebouncedValue(query, 200);
  // Lockouts and invitation expiries are compared against one committed clock
  // tick, never against Date.now() inside the render body.
  const now = useNow(30_000);
  const pending = actions.pending;

  const stats = useMemo(() => {
    let active = 0;
    let suspended = 0;
    let locked = 0;
    let awaiting = 0;
    let enrolled2fa = 0;
    roster.forEach(person => {
      if (person.isActive) active += 1; else suspended += 1;
      if (person.lockedUntil && new Date(person.lockedUntil).getTime() > now) locked += 1;
      if (person.verificationStatus === 'PENDING_REVIEW') awaiting += 1;
      if (person.isTotpEnabled) enrolled2fa += 1;
    });
    return { total: roster.length, active, suspended, locked, awaiting, enrolled2fa };
  }, [roster, now]);

  const credentialQueue = useMemo(
    () => roster.filter(person => person.verificationStatus === 'PENDING_REVIEW'),
    [roster],
  );

  const filtered = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return roster.filter(person => {
      if (roleFilter !== 'ALL' && person.role !== roleFilter) return false;
      if (filter === 'ACTIVE' && !person.isActive) return false;
      if (filter === 'SUSPENDED' && person.isActive) return false;
      if (filter === 'LOCKED' && !(person.lockedUntil && new Date(person.lockedUntil).getTime() > now)) return false;
      if (filter === 'PENDING_CREDENTIALS' && person.verificationStatus !== 'PENDING_REVIEW') return false;
      if (!needle) return true;
      return (
        person.email?.toLowerCase().includes(needle)
        || `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim().toLowerCase().includes(needle)
        || person.role?.toLowerCase().includes(needle)
        || person.medicalLicenseNo?.toLowerCase().includes(needle)
      );
    });
  }, [roster, debouncedQuery, filter, roleFilter, now]);

  const { page, visible, setPage, total } = usePagedRows(filtered, 12);

  const selectableOnPage = useMemo(
    () => visible.filter(person => person.id !== operatorId).map(person => person.id),
    [visible, operatorId],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelected(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]));
  }, []);

  const togglePage = useCallback(() => {
    setSelected(current => {
      const allOn = selectableOnPage.every(id => current.includes(id));
      if (allOn) return current.filter(id => !selectableOnPage.includes(id));
      return [...new Set([...current, ...selectableOnPage])];
    });
  }, [selectableOnPage]);

  const exportRoster = useCallback(() => {
    const csv = toCsv(
      ['Name', 'Email', 'Role', 'Status', 'Credential review', 'License', 'Jurisdiction', 'Specialty', '2FA enrolled', 'Locked until', 'Registered'],
      filtered.map(person => [
        fullName(person),
        person.email,
        person.role,
        person.isActive ? 'ACTIVE' : 'SUSPENDED',
        person.verificationStatus ?? 'UNVERIFIED',
        person.medicalLicenseNo ?? '',
        person.licenseJurisdiction ?? '',
        person.specialty ?? '',
        person.isTotpEnabled ? 'YES' : 'NO',
        person.lockedUntil ?? '',
        person.createdAt,
      ]),
    );
    downloadCsv(csvFileName('workforce-roster'), csv);
  }, [filtered]);

  const decide = useCallback(
    (person: AdminUser, status: 'VERIFIED' | 'REJECTED') =>
      void actions.decideCredentials(person.id, status, fullName(person)),
    [actions],
  );

  const reissueTotp = useCallback(
    async (person: AdminUser) => {
      const result = await actions.resetTotp(person.id, fullName(person));
      const secret = (result.data as { secret?: string } | undefined)?.secret;
      if (result.ok && secret) setTotpResult({ name: fullName(person), secret });
    },
    // The state setters are listed even though React keeps them stable: the
    // compiler's dependency inference treats them as values, and matching it
    // keeps this callback memoised instead of skipping the whole component.
    [actions, setTotpResult],
  );

  const confirmPurge = useCallback(async () => {
    if (!purgeTargets) return;
    const result = await actions.purgeUsers(purgeTargets.map(person => person.id), `${purgeTargets.length} account(s)`);
    if (result.ok) {
      setSelected([]);
      setPurgeTargets(null);
    }
  }, [actions, purgeTargets, setSelected, setPurgeTargets]);

  const activeInvite = invites.find(invite => !invite.isAccepted && new Date(invite.expiresAt).getTime() > now);

  return (
    <ResourceGate
      resources={[users]}
      onRetry={onRetry}
      skeleton={<div className="space-y-6"><SkeletonGrid cards={4} /><SkeletonRows rows={8} /></div>}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Accounts" value={stats.total} tone="info" />
        <Metric label="Active" value={stats.active} tone="success" />
        <Metric label="Suspended" value={stats.suspended} tone={stats.suspended ? 'warning' : 'neutral'} />
        <Metric label="Locked out" value={stats.locked} tone={stats.locked ? 'danger' : 'neutral'} />
        <Metric label="Awaiting credentials" value={stats.awaiting} tone={stats.awaiting ? 'warning' : 'success'} />
        <Metric label="2FA enrolled" value={stats.enrolled2fa} tone="purple" hint={formatCountPercent(stats.enrolled2fa, stats.total)} />
      </div>

      {credentialQueue.length > 0 && (
        <Panel
          title="Credential review queue"
          icon={BadgeCheck}
          description="License, jurisdiction and specialty attestations submitted by staff and awaiting an administrative decision."
          actions={<Badge tone="warning">{credentialQueue.length} PENDING</Badge>}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-slate-800">
            {credentialQueue.map(person => (
              <li key={person.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[11px] font-bold ${roleAccent(person.role)}`}>
                  {initialsOf(person.firstName, person.lastName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{fullName(person)}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{person.email}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {humanizeRole(person.role)}
                    {person.medicalLicenseNo ? ` · licence ${person.medicalLicenseNo}` : ''}
                    {person.licenseJurisdiction ? ` (${person.licenseJurisdiction})` : ''}
                    {person.specialty ? ` · ${person.specialty}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="success"
                    icon={UserCheck}
                    busy={pending === `credentials:${person.id}`}
                    onClick={() => decide(person, 'VERIFIED')}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    icon={XCircle}
                    busy={pending === `credentials:${person.id}`}
                    onClick={() => decide(person, 'REJECTED')}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Workforce directory"
        icon={Users}
        description="Role-based access control over every non-patient identity."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search name, email, licence"
                aria-label="Search workforce"
                className={`${INPUT_CLASS} w-56 pl-8`}
              />
            </div>
            <select
              value={roleFilter}
              onChange={event => setRoleFilter(event.target.value)}
              aria-label="Filter by role"
              className={`${INPUT_CLASS} w-40`}
            >
              <option value="ALL">All roles</option>
              {PROVISIONABLE_ROLES.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
            <select
              value={filter}
              onChange={event => setFilter(event.target.value as DirectoryFilter)}
              aria-label="Filter by state"
              className={`${INPUT_CLASS} w-40`}
            >
              {FILTERS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <Button variant="secondary" icon={Download} onClick={exportRoster} disabled={filtered.length === 0}>
              Export
            </Button>
            <Button variant="primary" icon={UserPlus} onClick={onOpenProvision}>
              New staff
            </Button>
          </>
        }
        bodyClassName="p-0"
      >
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title={roster.length === 0 ? 'No staff accounts exist yet' : 'No account matches these filters'}
              description={
                roster.length === 0
                  ? 'Provision the first physician, nurse or pharmacist account to begin.'
                  : 'Clear the search box or widen the filters to see more of the roster.'
              }
              action={<Button variant="primary" icon={UserPlus} onClick={onOpenProvision}>Provision staff</Button>}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-xs">
                <thead className="bg-slate-900/70 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="w-10 px-5 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all rows on this page"
                        checked={selectableOnPage.length > 0 && selectableOnPage.every(id => selected.includes(id))}
                        onChange={togglePage}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950"
                      />
                    </th>
                    <th scope="col" className="px-3 py-3">Identity</th>
                    <th scope="col" className="px-3 py-3">Role</th>
                    <th scope="col" className="px-3 py-3">State</th>
                    <th scope="col" className="px-3 py-3">2FA</th>
                    <th scope="col" className="px-3 py-3">Reassign role</th>
                    <th scope="col" className="px-5 py-3 text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visible.map(person => {
                    const isSelf = person.id === operatorId;
                    const locked = !!person.lockedUntil && new Date(person.lockedUntil).getTime() > now;
                    const busy = pending?.endsWith(`:${person.id}`);
                    return (
                      <tr key={person.id} className="align-top hover:bg-slate-800/40">
                        <td className="px-5 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${fullName(person)}`}
                            disabled={isSelf}
                            checked={selected.includes(person.id)}
                            onChange={() => toggleSelected(person.id)}
                            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 disabled:opacity-30"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[10px] font-bold ${roleAccent(person.role)}`}>
                              {initialsOf(person.firstName, person.lastName)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-100">
                                {fullName(person)}
                                {isSelf && <span className="ml-1.5 font-mono text-[10px] text-purple-300">(YOU)</span>}
                              </p>
                              <p className="truncate font-mono text-[10px] text-slate-500">{person.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${roleAccent(person.role)}`}>
                            {humanizeRole(person.role)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge tone={person.isActive ? 'success' : 'danger'}>{person.isActive ? 'ACTIVE' : 'SUSPENDED'}</Badge>
                            {locked && <Badge tone="warning">LOCKED</Badge>}
                            <Badge tone={verificationTone(person.verificationStatus)}>
                              {person.verificationStatus ?? 'UNVERIFIED'}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={person.isTotpEnabled ? 'success' : 'neutral'}>
                            {person.isTotpEnabled ? 'ENROLLED' : 'NOT SET UP'}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={person.role}
                            disabled={isSelf || busy}
                            aria-label={`Reassign role for ${fullName(person)}`}
                            onChange={event => void actions.updateRole(person.id, event.target.value as AdminUser['role'])}
                            className={`${INPUT_CLASS} w-36 disabled:opacity-40`}
                          >
                            <option value={person.role}>{humanizeRole(person.role)}</option>
                            {PROVISIONABLE_ROLES
                              .filter(role => role.value !== person.role)
                              .map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              icon={person.isActive ? Ban : UserCheck}
                              busy={pending === `status:${person.id}`}
                              disabled={isSelf}
                              title={isSelf ? 'You cannot suspend your own session' : person.isActive ? 'Suspend access' : 'Restore access'}
                              onClick={() => void actions.setActive(person.id, !person.isActive, fullName(person))}
                            >
                              {person.isActive ? 'Suspend' : 'Restore'}
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
                            <Button
                              variant="danger"
                              icon={Trash2}
                              disabled={isSelf}
                              title={isSelf ? 'You cannot delete your own account' : 'Permanently purge this account'}
                              onClick={() => setPurgeTargets([person])}
                            >
                              Purge
                            </Button>
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

      {selected.length > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/40 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-semibold text-red-200">
            {selected.length} account{selected.length === 1 ? '' : 's'} selected — bulk actions are logged and chain-anchored
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected([])}>Clear selection</Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => setPurgeTargets(roster.filter(person => selected.includes(person.id)))}
            >
              Purge selected
            </Button>
          </div>
        </div>
      )}

      {/* Invitations */}
      <Panel
        title="Staff onboarding invitations"
        icon={UserPlus}
        description="Single-use activation tokens. The link is shown once at issuance and only its hash is stored server-side."
        actions={<Button variant="primary" icon={UserPlus} onClick={onOpenProvision}>Issue invitation</Button>}
        bodyClassName="p-0"
      >
        {invitations.status === 'loading' || invitations.status === 'idle' ? (
          <div className="p-5"><SkeletonRows rows={3} /></div>
        ) : invitations.status === 'error' ? (
          <div className="p-5">
            <EmptyState
              icon={XCircle}
              title="Invitation list unavailable"
              description={invitations.error || 'The invitations endpoint did not respond.'}
              action={<Button variant="secondary" onClick={() => onRetry()}>Retry</Button>}
            />
          </div>
        ) : invites.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={UserPlus}
              title="No invitations issued"
              description="Onboarding links you generate appear here with their expiry state so you can revoke one before it is accepted."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {invites.map(invite => {
              const expired = new Date(invite.expiresAt).getTime() <= now;
              const tone = invite.isAccepted ? 'success' : expired ? 'neutral' : 'warning';
              const label = invite.isAccepted ? 'ACCEPTED' : expired ? 'EXPIRED' : 'AWAITING ACTIVATION';
              return (
                <li key={invite.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-100">{invite.email}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                      {humanizeRole(invite.role)} · issued {formatDateTime(invite.createdAt)} · expires {formatDateTime(invite.expiresAt)}
                    </p>
                  </div>
                  <Badge tone={tone}>{label}</Badge>
                  {label === 'AWAITING ACTIVATION' && (
                    <Button
                      variant="danger"
                      icon={Ban}
                      busy={pending === `revoke:${invite.id}`}
                      onClick={() => void actions.revokeInvitation(invite.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {activeInvite && (
        <p className="text-[11px] text-slate-500">
          Note: {activeInvite.email} holds an unactivated invitation. Expiry is enforced by the server
          (default 60 minutes, configurable via INVITE_DEFAULT_EXPIRATION_MINUTES).
        </p>
      )}

      <ConfirmModal
        open={!!purgeTargets}
        title={purgeTargets?.length === 1 ? 'Permanently purge account' : `Permanently purge ${purgeTargets?.length ?? 0} accounts`}
        description="This deletes the identity and every cascaded clinical, financial and prescription relation. It cannot be undone and no export can restore it."
        confirmPhrase="PURGE"
        phraseHint="Type PURGE to enable the irreversible action"
        busy={pending?.startsWith('purge:') ?? false}
        onConfirm={confirmPurge}
        onClose={() => setPurgeTargets(null)}
      >
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/60 p-3">
          {(purgeTargets ?? []).map(person => (
            <li key={person.id} className="font-mono text-[11px] text-slate-300">
              {fullName(person)} · {person.email} · {humanizeRole(person.role)}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-400">
          Prefer removing access without destroying the record? Use Suspend on the row instead — it is reversible.
        </p>
      </ConfirmModal>

      <Modal
        open={!!totpResult}
        onClose={() => setTotpResult(null)}
        title="New 2FA enrolment secret"
        description="Transmit this out-of-band to the account holder. It is shown once and is not retrievable from this console afterwards."
        icon={KeyRound}
        tone="warning"
        footer={<Button variant="primary" onClick={() => setTotpResult(null)}>Done — secret delivered</Button>}
      >
        <p className="text-xs text-slate-300">
          {totpResult?.name} must re-scan this secret in their authenticator app. The previous enrolment is now invalid.
        </p>
        {totpResult && <SecretField label="Base32 secret" value={totpResult.secret} />}
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-200">
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          A re-issued secret counts as a fresh enrolment. The account is not two-factor protected until the holder
          completes verification in their own dashboard.
        </div>
      </Modal>
    </ResourceGate>
  );
};

function formatCountPercent(value: number, total: number): string {
  if (!total) return 'no accounts yet';
  return `${Math.round((value / total) * 100)}% of roster`;
}

export default React.memo(WorkforceSection);
