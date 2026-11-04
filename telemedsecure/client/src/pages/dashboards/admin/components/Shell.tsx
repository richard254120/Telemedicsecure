/**
 * Application shell for the admin console: persistent grouped navigation, a
 * sticky context bar, and the content region the lazy panels mount into.
 *
 * This replaces the horizontal strip of seven tab buttons — labels truncated
 * to single-word captions, counts unavailable until the fan-out finished, and
 * no way to see where you were on a phone. The rail is grouped by operational
 * concern, stays fixed on desktop, and collapses into a drawer below `lg`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  ChevronDown,
  Calendar,
  FileCheck2,
  FileSearch,
  KeyRound,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { AuthUser } from '../../../../context/AuthContext';
import type { ResourceStatus } from '../hooks/useAdminData';
import { formatAge } from '../lib/format';
import { useNow } from '../hooks/useNow';
import { Button } from './ui';

export type TabId =
  | 'overview'
  | 'compliance'
  | 'users'
  | 'patients'
  | 'prescriptions'
  | 'investigation'
  | 'sms';

export interface TabDescriptor {
  id: TabId;
  label: string;
  caption: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_TABS: TabDescriptor[] = [
  { id: 'overview', label: 'Platform Overview', caption: 'Live telemetry & KPIs', group: 'Command', icon: Activity },
  { id: 'compliance', label: 'Compliance & Alerts', caption: 'Violations, audit chain', group: 'Integrity', icon: ShieldCheck },
  { id: 'investigation', label: 'Incident Casework', caption: 'Open forensic probes', group: 'Integrity', icon: FileSearch },
  { id: 'prescriptions', label: 'EPCS Audit', caption: 'Rx signature ledger', group: 'Integrity', icon: FileCheck2 },
  { id: 'users', label: 'Workforce & RBAC', caption: 'Staff, roles, provisioning', group: 'Identity', icon: Users },
  { id: 'patients', label: 'Patient Registry', caption: 'Enrollment & account state', group: 'Identity', icon: User },
  { id: 'sms', label: 'SMS Gateway', caption: 'Dispatch ledger', group: 'Operations', icon: Smartphone },
];

export const TAB_GROUPS: string[] = ['Command', 'Integrity', 'Identity', 'Operations'];

export function isTabId(value: string | null | undefined): value is TabId {
  return !!value && ADMIN_TABS.some(tab => tab.id === value);
}

interface CountChip {
  value: number;
  status: ResourceStatus;
}

export interface ShellProps {
  user: AuthUser | null;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  counts: Partial<Record<TabId, CountChip>>;
  lastSyncedAt: number | null;
  isRefreshing: boolean;
  sessionExpired: boolean;
  onRefresh: () => void;
  onOpenProvision: () => void;
  onOpenDossier: () => void;
  onOpenTwoFactor: () => void;
  onSignOut: () => void;
  onOpenCalendar: () => void;
  children: React.ReactNode;
}

function NavList({
  activeTab,
  counts,
  onSelect,
}: Pick<ShellProps, 'activeTab' | 'counts'> & { onSelect: (tab: TabId) => void }) {
  return (
    <div className="space-y-6">
      {TAB_GROUPS.map(group => (
        <nav key={group} aria-label={group}>
          <p className="mb-2 px-3 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{group}</p>
          <ul className="space-y-1">
            {ADMIN_TABS.filter(tab => tab.group === group).map(tab => {
              const active = tab.id === activeTab;
              const chip = counts[tab.id];
              const Icon = tab.icon;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(tab.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                      active
                        ? 'bg-purple-500/15 text-white ring-1 ring-purple-500/40'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-purple-300' : 'text-slate-500 group-hover:text-cyan-400'}`} />
                    <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                    {chip && chip.status === 'success' && (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                          chip.value > 0 && (tab.id === 'compliance' || tab.id === 'investigation')
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {chip.value}
                      </span>
                    )}
                    {chip && chip.status === 'error' && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" title="Failed to load" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      ))}
    </div>
  );
}

const Shell: React.FC<ShellProps> = ({
  user,
  activeTab,
  onSelectTab,
  counts,
  lastSyncedAt,
  isRefreshing,
  sessionExpired,
  onRefresh,
  onOpenProvision,
  onOpenDossier,
  onOpenTwoFactor,
  onSignOut,
  onOpenCalendar,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  // "updated 3m ago" is derived from a shared clock tick rather than from a
  // Date.now() read in the render body, so the label cannot change when React
  // re-renders the console for an unrelated reason.
  const now = useNow(15_000);
  const syncedAge = useMemo(() => formatAge(lastSyncedAt, now).toUpperCase(), [lastSyncedAt, now]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const selectTab = useCallback((tab: TabId) => { onSelectTab(tab); setDrawerOpen(false); }, [onSelectTab]);

  useEffect(() => {
    if (!accountOpen) return;
    const onDocClick = () => setAccountOpen(false);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [accountOpen]);

  const descriptor = ADMIN_TABS.find(tab => tab.id === activeTab) ?? ADMIN_TABS[0];
  const initials = `${user?.firstName?.[0] ?? 'A'}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const sidebarInner = (
    <div className="flex h-full flex-col gap-6 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-300">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-black text-white">TeleMedSecure</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Admin Console</p>
          </div>
        </div>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close navigation"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <NavList activeTab={activeTab} counts={counts} onSelect={selectTab} />

      <div className="mt-auto space-y-2 border-t border-slate-800 pt-4 text-[10px] text-slate-500">
        <div className="flex items-center gap-2 font-mono">
          <Bell className="h-3 w-3" />
          <span>{sessionExpired ? 'SESSION EXPIRED' : `SYNCED ${syncedAge}`}</span>
        </div>
        <p>Roster, EPCS and audit data are PHI. Access is logged and chain-anchored.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-purple-600 focus:px-3 focus:py-2 focus:text-xs">
        Skip to main content
      </a>

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-[264px] border-r border-slate-800 bg-slate-900/95 lg:block">
        {sidebarInner}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeDrawer} />
          <aside className="animate-fadeIn absolute inset-y-0 left-0 w-[272px] border-r border-slate-800 bg-slate-900 shadow-2xl">
            {sidebarInner}
          </aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:text-white lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {descriptor.group} / {descriptor.caption}
              </p>
              <h1 className="truncate text-lg font-black text-white">{descriptor.label}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 font-mono text-[10px] text-slate-400 sm:flex">
                <span className={`h-1.5 w-1.5 rounded-full ${sessionExpired ? 'bg-red-400' : isRefreshing ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                {sessionExpired ? 'SIGN-IN REQUIRED' : isRefreshing ? 'SYNCING…' : `UPDATED ${syncedAge}`}
              </span>

              <Button variant="ghost" icon={RefreshCw} busy={isRefreshing} onClick={onRefresh} aria-label="Refresh all data">
                Refresh
              </Button>
              <Button variant="secondary" icon={Calendar} onClick={onOpenCalendar} className="hidden sm:inline-flex">
                Calendar
              </Button>
              <Button variant="success" icon={FileSearch} onClick={onOpenDossier} title="HIPAA §164.312 audit dossier">
                Audit Dossier
              </Button>
              <Button variant="primary" icon={UserPlus} onClick={onOpenProvision}>
                Provision Staff
              </Button>

              <div className="relative" onClick={event => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setAccountOpen(open => !open)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-2 py-1.5 text-xs transition hover:bg-slate-700"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-[10px] font-bold text-purple-200">
                    {initials}
                  </span>
                  <span className="hidden max-w-[120px] truncate font-semibold text-slate-200 sm:block">
                    {user?.firstName ?? 'Admin'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="animate-fadeIn absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                  >
                    <div className="border-b border-slate-800 px-4 py-3">
                      <p className="text-xs font-bold text-white">{user?.firstName} {user?.lastName}</p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{user?.email}</p>
                      <p className="mt-1.5 inline-flex rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] text-purple-300">
                        {user?.role}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setAccountOpen(false); onOpenTwoFactor(); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      <KeyRound className="h-3.5 w-3.5" /> My 2FA enrolment
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setAccountOpen(false); onSignOut(); }}
                      className="flex w-full items-center gap-2 border-t border-slate-800 px-4 py-2.5 text-left text-xs text-red-300 hover:bg-red-950/40"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign out of console
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main id="admin-main" className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1500px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default React.memo(Shell);
