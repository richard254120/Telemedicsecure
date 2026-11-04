/**
 * Shared navigation + shell contracts for every role dashboard.
 *
 * The admin console proved the layout (grouped sidebar rail + sticky context
 * header + sync chip + account menu). These types generalise it so Patient,
 * Doctor, Nurse, the allied stations and Admin all mount into the *same* shell,
 * differing only by accent colour and the navigation groups they are given.
 */
import type { ComponentType, ReactNode } from 'react';
import type { AuthUser } from '../context/AuthContext';
import type { ResourceStatus } from './store';
import type { Tone } from './format';

export type IconType = ComponentType<{ className?: string }>;

export interface NavTab {
  id: string;
  label: string;
  /** Secondary line shown in the sticky header when the tab is active. */
  caption?: string;
  group: string;
  icon: IconType;
  /**
   * Route to navigate to (a cross-station or record link). When omitted the tab
   * behaves as an in-page section switcher driven by `onSelectTab`.
   */
  to?: string;
  /** Optional alert count rendered as a pill (e.g. pending items). */
  badge?: number;
  badgeTone?: Tone;
}

export interface NavGroup { name: string; tabs: NavTab[]; }

export type AccentToken = 'blue' | 'emerald' | 'teal' | 'cyan' | 'purple' | 'amber';

export interface AccentClasses {
  activeItem: string;
  activeIcon: string;
  brandTile: string;
  avatar: string;
  roleChip: string;
}

/**
 * Per-role accent ramps. The class strings are written in full (never composed
 * dynamically) so Tailwind's JIT scanner keeps them in the production bundle.
 */
export const ACCENTS: Record<AccentToken, AccentClasses> = {
  purple: {
    activeItem: 'bg-purple-500/15 text-white ring-1 ring-purple-500/40',
    activeIcon: 'text-purple-300',
    brandTile: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
    avatar: 'bg-purple-500/20 text-purple-200',
    roleChip: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  blue: {
    activeItem: 'bg-blue-500/15 text-white ring-1 ring-blue-500/40',
    activeIcon: 'text-blue-300',
    brandTile: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
    avatar: 'bg-blue-500/20 text-blue-200',
    roleChip: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  emerald: {
    activeItem: 'bg-emerald-500/15 text-white ring-1 ring-emerald-500/40',
    activeIcon: 'text-emerald-300',
    brandTile: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    avatar: 'bg-emerald-500/20 text-emerald-200',
    roleChip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  teal: {
    activeItem: 'bg-teal-500/15 text-white ring-1 ring-teal-500/40',
    activeIcon: 'text-teal-300',
    brandTile: 'border-teal-500/40 bg-teal-500/10 text-teal-300',
    avatar: 'bg-teal-500/20 text-teal-200',
    roleChip: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  },
  cyan: {
    activeItem: 'bg-cyan-500/15 text-white ring-1 ring-cyan-500/40',
    activeIcon: 'text-cyan-300',
    brandTile: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    avatar: 'bg-cyan-500/20 text-cyan-200',
    roleChip: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
  amber: {
    activeItem: 'bg-amber-500/15 text-white ring-1 ring-amber-500/40',
    activeIcon: 'text-amber-300',
    brandTile: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    avatar: 'bg-amber-500/20 text-amber-200',
    roleChip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
};

export interface CountChip { value: number; status: ResourceStatus; }

export interface ShellProps {
  user: AuthUser | null;
  nav: NavGroup[];
  accent: AccentToken;
  brandTitle: string;
  brandSubtitle?: string;
  /** Active in-page section id (for tab-style dashboards like Admin). */
  activeTab?: string;
  onSelectTab?: (id: string) => void;
  counts?: Record<string, CountChip>;
  lastSyncedAt?: number | null;
  isRefreshing?: boolean;
  sessionExpired?: boolean;
  onRefresh?: () => void;
  /** Buttons rendered in the sticky header (role-specific primary actions). */
  headerActions?: ReactNode;
  onOpenTwoFactor?: () => void;
  onSignOut: () => void;
  mainId?: string;
  children: ReactNode;
}
