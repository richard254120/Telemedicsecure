/**
 * Application shell shared by every role dashboard.
 *
 * This is the admin console's proven layout — persistent grouped navigation
 * rail, sticky context header, sync chip, and account menu — generalised so
 * Patient, Doctor, Nurse, the allied stations and Admin all mount into the same
 * chrome. Dashboards differ only by `accent`, `brandTitle` and the `nav` groups
 * they are handed.
 *
 * Two tab flavours are supported side by side:
 *  - a tab with `to` navigates (cross-station / record handoff links);
 *  - a tab without `to` toggles an in-page section via `onSelectTab` (Admin).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, KeyRound, LogOut, Menu, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { formatAge, initialsOf } from './format';
import { useNow } from './hooks/useNow';
import { ACCENTS, type NavTab, type ShellProps } from './types';
import { Button } from './ui';
import ThemeToggle from '../components/ThemeToggle';

function NavList({
  nav,
  accent,
  activeTab,
  counts,
  isRouteActive,
  onSelect,
}: Pick<ShellProps, 'accent' | 'activeTab' | 'counts'> & {
  nav: ShellProps['nav'];
  isRouteActive: (to: string) => boolean;
  onSelect: (tab: NavTab) => void;
}) {
  const groupNames = useMemo(() => Array.from(new Set(nav.flatMap(group => [group.name]))), [nav]);

  return (
    <div className="space-y-6">
      {groupNames.map(name => (
        <nav key={name} aria-label={name}>
          <p className="mb-2 px-3 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{name}</p>
          <ul className="space-y-1">
            {nav
              .filter(group => group.name === name)
              .flatMap(group => group.tabs)
              .map(tab => {
                const active = tab.to ? isRouteActive(tab.to) : tab.id === activeTab;
                const chip = counts?.[tab.id];
                const Icon = tab.icon;
                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(tab)}
                      aria-current={active ? 'page' : undefined}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                        active ? ACCENTS[accent].activeItem : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? ACCENTS[accent].activeIcon : 'text-slate-500 group-hover:text-cyan-400'}`} />
                      <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                      {typeof tab.badge === 'number' && tab.badge > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                          {tab.badge}
                        </span>
                      )}
                      {chip && chip.status === 'success' && (
                        <span className="shrink-0 rounded-full bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">{chip.value}</span>
                      )}
                      {chip && chip.status === 'error' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" title="Failed to load" />}
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
  nav,
  accent,
  brandTitle,
  brandSubtitle,
  activeTab,
  onSelectTab,
  counts,
  lastSyncedAt,
  isRefreshing,
  sessionExpired,
  onRefresh,
  headerActions,
  onOpenTwoFactor,
  onSignOut,
  mainId = 'station-main',
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  // "updated 3m ago" derives from a shared clock tick, not a Date.now() read in
  // the render body, so the label cannot shift on an unrelated re-render.
  const now = useNow(15_000);
  const accentClasses = ACCENTS[accent];
  const syncedAge = useMemo(() => formatAge(lastSyncedAt ?? null, now).toUpperCase(), [lastSyncedAt, now]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const isRouteActive = useCallback(
    (to: string) => location.pathname === to || (to !== '/' && location.pathname.startsWith(to)),
    [location.pathname],
  );

  const selectTab = useCallback(
    (tab: NavTab) => {
      if (tab.to) navigate(tab.to);
      else onSelectTab?.(tab.id);
      setDrawerOpen(false);
    },
    [navigate, onSelectTab],
  );

  useEffect(() => {
    if (!accountOpen) return;
    const onDocClick = () => setAccountOpen(false);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [accountOpen]);

  const allTabs = useMemo(() => nav.flatMap(group => group.tabs), [nav]);
  const descriptor =
    allTabs.find(tab => (tab.to ? isRouteActive(tab.to) : tab.id === activeTab)) ?? allTabs[0];
  const initials = initialsOf(user?.firstName, user?.lastName);

  const sidebarInner = (
    <div className="flex h-full flex-col gap-6 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${accentClasses.brandTile}`}>
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-black text-white">{brandTitle}</p>
            {brandSubtitle && (
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{brandSubtitle}</p>
            )}
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

      <NavList
        nav={nav}
        accent={accent}
        activeTab={activeTab}
        counts={counts}
        isRouteActive={isRouteActive}
        onSelect={selectTab}
      />

      <div className="mt-auto space-y-2 border-t border-slate-800 pt-4 text-[10px] text-slate-500">
        <div className="flex items-center gap-2 font-mono">
          <Bell className="h-3 w-3" />
          <span>{sessionExpired ? 'SESSION EXPIRED' : lastSyncedAt ? `SYNCED ${syncedAge}` : 'ONLINE'}</span>
        </div>
        <p>Patient data shown here is PHI. Access is logged and chain-anchored.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <a
        href={`#${mainId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-purple-600 focus:px-3 focus:py-2 focus:text-xs"
      >
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
              {descriptor?.caption && (
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {descriptor.group} / {descriptor.caption}
                </p>
              )}
              <h1 className="truncate text-lg font-black text-white">{descriptor?.label ?? brandTitle}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {lastSyncedAt !== undefined && (
                <span className="hidden items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 font-mono text-[10px] text-slate-400 sm:flex">
                  <span className={`h-1.5 w-1.5 rounded-full ${sessionExpired ? 'bg-red-400' : isRefreshing ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  {sessionExpired ? 'SIGN-IN REQUIRED' : isRefreshing ? 'SYNCING…' : `UPDATED ${syncedAge}`}
                </span>
              )}

              {onRefresh && (
                <Button variant="ghost" icon={RefreshCw} busy={isRefreshing} onClick={onRefresh} aria-label="Refresh data">
                  Refresh
                </Button>
              )}
              {headerActions}

              {/* Whole-page dark / light switch, present on every station. */}
              <ThemeToggle />

              <div className="relative" onClick={event => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setAccountOpen(open => !open)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-2 py-1.5 text-xs transition hover:bg-slate-700"
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${accentClasses.avatar}`}>
                    {initials}
                  </span>
                  <span className="hidden max-w-[120px] truncate font-semibold text-slate-200 sm:block">
                    {user?.firstName ?? 'Account'}
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
                      <p className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] ${accentClasses.roleChip}`}>
                        {user?.role}
                      </p>
                    </div>
                    {onOpenTwoFactor && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setAccountOpen(false); onOpenTwoFactor(); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> My 2FA enrolment
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setAccountOpen(false); onSignOut(); }}
                      className="flex w-full items-center gap-2 border-t border-slate-800 px-4 py-2.5 text-left text-xs text-red-300 hover:bg-red-950/40"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main id={mainId} className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1500px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default React.memo(Shell);
