/**
 * Presentation helpers shared by the admin console.
 *
 * The `nullable` formatters here exist for one reason: the previous dashboard
 * invented numbers whenever the backend stayed quiet
 * (`severity.CRITICAL || 2`, `dbLatencyMs ?? 8`, `?? '48h 12m (99.99%)'`),
 * which made an outage indistinguishable from a healthy platform. Every
 * formatter now returns an explicit "unreported" marker instead.
 */

export const UNREPORTED = '—';

export type MaybeNumber = number | null | undefined;

export function formatCount(value: MaybeNumber, suffix = ''): string {
  if (value === null || value === undefined || Number.isNaN(value)) return UNREPORTED;
  return `${value.toLocaleString()}${suffix}`;
}

export function formatPercent(value: MaybeNumber): string {
  if (value === null || value === undefined || Number.isNaN(value)) return UNREPORTED;
  return `${Math.round(value)}%`;
}

export function formatCurrency(value: MaybeNumber): string {
  if (value === null || value === undefined || Number.isNaN(value)) return UNREPORTED;
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function formatUptime(seconds: MaybeNumber): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return UNREPORTED;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatDateTime(value: string | number | null | undefined): string {
  if (!value) return UNREPORTED;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNREPORTED;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatClock(value: string | number | null | undefined): string {
  if (!value) return UNREPORTED;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNREPORTED;
  return date.toLocaleTimeString();
}

/**
 * Relative age of a fetch, for the shell's "updated …" chip.
 *
 * `now` is supplied by the caller's `useNow()` tick instead of being read from
 * the clock here: a component that calls Date.now() during render is impure and
 * lets ages shift whenever React re-renders for an unrelated reason.
 */
export function formatAge(timestamp: number | null, now: number): string {
  if (!timestamp) return 'never';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

/**
 * Mask everything but the final four digits of a phone number, keeping its
 * spacing intact. Used by the SMS ledger, where a shoulder-surfing risk on a
 * shared admin screen outweighs the convenience of reading the whole number.
 */
export function formatNumberMasked(value: string | null | undefined): string {
  if (!value) return UNREPORTED;
  const digitCount = value.replace(/\D/g, '').length;
  if (digitCount <= 4) return '••••';
  let seen = 0;
  return value.replace(/\d/g, digit => {
    seen += 1;
    return seen <= digitCount - 4 ? '•' : digit;
  });
}

/** Compact role label for chips and table cells (LAB_TECHNICIAN -> Lab Tech). */
export function humanizeRole(role: string | null | undefined): string {
  if (!role) return UNREPORTED;
  return role
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Deterministic initials for the avatar bubble, without touching PHI beyond names. */
export function initialsOf(firstName?: string | null, lastName?: string | null): string {
  return `${firstName?.[0] ?? 'U'}${lastName?.[0] ?? ''}`.toUpperCase();
}

export function fullName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }): string {
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || user.email || UNREPORTED;
}

/**
 * Tailwind tone ramp used by badges, so status colouring stays consistent
 * across the seven panels instead of being re-spelled per JSX branch.
 */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple';

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  info: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  danger: 'bg-red-500/10 text-red-300 border-red-500/30',
  purple: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
};

/** Foreground-only ramp, for large numerals where a background chip is noise. */
export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-slate-200',
  info: 'text-cyan-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-red-300',
  purple: 'text-purple-300',
};

export function severityTone(severity?: string | null): Tone {
  switch (severity) {
    case 'CRITICAL': return 'danger';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'info';
    case 'LOW': return 'neutral';
    default: return 'neutral';
  }
}

export function verificationTone(status?: string | null): Tone {
  switch (status) {
    case 'VERIFIED': return 'success';
    case 'PENDING_REVIEW': return 'warning';
    case 'REJECTED': return 'danger';
    default: return 'neutral';
  }
}

export function incidentTone(status?: string | null): Tone {
  switch (status) {
    case 'OPEN': return 'danger';
    case 'INVESTIGATING': return 'warning';
    case 'CLOSED': case 'RESOLVED': return 'success';
    default: return 'neutral';
  }
}

export function signatureTone(status?: string | null): Tone {
  return status === 'VALID' ? 'success' : 'danger';
}

/** Role -> accent classes for the avatar bubble and role chip. */
export function roleAccent(role: string): string {
  switch (role) {
    case 'DOCTOR': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'NURSE': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'ADMIN': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'PHARMACIST': return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
    case 'RADIOLOGIST': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    case 'LAB_TECHNICIAN': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'BILLING_OFFICER': return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
    default: return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}
