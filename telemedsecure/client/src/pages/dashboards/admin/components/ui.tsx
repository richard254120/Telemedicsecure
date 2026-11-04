/**
 * Presentational primitives for the admin console.
 *
 * Everything here exists to delete repetition: the old component spelled the
 * same card chrome, the same status pill class ramp, and the same five
 * hand-rolled fixed-position modals hundreds of times, and none of those
 * modals were keyboard- or screen-reader-accessible.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Eye, EyeOff, Inbox, RefreshCw, X } from 'lucide-react';
import { TONE_CLASSES, TONE_TEXT, type Tone } from '../lib/format';
import type { ResourceState } from '../hooks/useAdminData';
import type { Toast } from '../hooks/useToast';

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-purple-600 hover:bg-purple-500 text-white border-transparent shadow-lg shadow-purple-600/20',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700',
  ghost: 'bg-transparent hover:bg-slate-800/70 text-slate-300 border-transparent',
  danger: 'bg-red-600 hover:bg-red-500 text-white border-transparent shadow-lg shadow-red-600/25',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow-lg shadow-emerald-600/25',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: React.ComponentType<{ className?: string }>;
  busy?: boolean;
}

export const Button = React.memo(function Button({
  variant = 'secondary',
  icon: Icon,
  busy = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ *
 * Chrome
 * ------------------------------------------------------------------ */

export interface PanelProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const Panel = React.memo(function Panel({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: PanelProps) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-800/70 shadow-lg ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-col gap-3 border-b border-slate-700/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && (
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                {Icon && <Icon className="h-4 w-4 shrink-0 text-cyan-400" />}
                <span className="truncate">{title}</span>
              </h3>
            )}
            {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
});

export const Badge = React.memo(function Badge({
  tone = 'neutral',
  children,
  mono = true,
  className = '',
}: {
  tone?: Tone;
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${mono ? 'font-mono' : 'font-semibold'} ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
});

export interface MetricProps {
  label: string;
  /** Pre-formatted string, or a raw number (0 renders as "0", never as "—"). */
  value: React.ReactNode | number | null | undefined;
  hint?: React.ReactNode;
  tone?: Tone;
  unreported?: boolean;
}

/**
 * A single measured figure. `unreported` is the honest state: the value was
 * never supplied by the backend, so the tile says so instead of guessing.
 */
export const Metric = React.memo(function Metric({ label, value, hint, tone = 'info', unreported = false }: MetricProps) {
  const missing = unreported || value === null || value === undefined;
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4">
      <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`mt-1 block text-xl font-black ${missing ? 'text-slate-500' : TONE_TEXT[tone]}`}>
        {missing ? 'Not reported' : typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * Loading / error / empty
 * ------------------------------------------------------------------ */

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div style={style} className={`animate-pulse rounded-xl bg-slate-700/40 ${className}`} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function SkeletonGrid({ cards = 4, span = 'sm:col-span-1' }: { cards?: number; span?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} className={`h-28 ${span}`} />
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  compact = false,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 ${compact ? 'p-3.5' : 'p-5'} sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        <div>
          <p className="text-xs font-bold text-red-200">This panel could not be loaded</p>
          <p className="mt-0.5 text-xs text-slate-300">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
      <Icon className="h-8 w-8 text-slate-600" />
      <p className="text-sm font-bold text-white">{title}</p>
      {description && <p className="max-w-md text-xs text-slate-400">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

/**
 * Gate a subtree on the status of the resources it renders: skeleton while
 * cold, an explicit retryable error state on failure, children only once the
 * data actually arrived. Prevents "0 violations" from being shown for an
 * endpoint that timed out.
 */
export function ResourceGate({
  resources,
  skeleton,
  onRetry,
  children,
}: {
  resources: ResourceState[];
  skeleton?: React.ReactNode;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  const failed = resources.find(resource => resource.status === 'error');
  if (failed) return <ErrorState message={failed.error || 'Request failed'} onRetry={onRetry} />;

  const cold = resources.some(resource => resource.status === 'idle' || resource.status === 'loading');
  if (cold) return <>{skeleton ?? <SkeletonRows />}</>;

  return <>{children}</>;
}

/* ------------------------------------------------------------------ *
 * Modal
 * ------------------------------------------------------------------ */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  size?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Marks the dialog as a document the operator prints (audit dossier, signed
   * prescription). The overlay stops being a fixed, clipped layer and the body
   * becomes the `print-document` subtree that index.css isolates under print.
   */
  printable?: boolean;
}

const MODAL_WIDTH = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl' } as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  tone = 'purple',
  size = 'md',
  children,
  footer,
  printable = false,
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Keep the underlying page from scrolling behind the dialog.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      // Minimal focus trap: cycle within the dialog.
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md ${
        printable ? 'print:static print:block print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none' : ''
      }`}
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        className={`max-h-[90vh] w-full ${MODAL_WIDTH[size]} overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-7 ${
          printable ? 'print:max-h-none print:max-w-none print:w-full print:overflow-visible print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none' : ''
        }`}
      >
        <header className={`mb-5 flex items-start justify-between gap-4 border-b border-slate-800 pb-4 ${printable ? 'print:hidden' : ''}`}>
          <div className="flex items-start gap-3">
            {Icon && (
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${TONE_CLASSES[tone]}`}>
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div>
              <h2 id="admin-modal-title" className="text-base font-bold text-white">{title}</h2>
              {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className={`space-y-4 ${printable ? 'print-document print:space-y-5' : ''}`}>{children}</div>

        {footer && (
          <footer className={`mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-4 ${printable ? 'print:hidden' : ''}`}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/**
 * Irreversible-action confirmation. Typing the target's identifier is
 * required for purges: bulk user deletion is the single most destructive
 * click in this console and used to be one accidental Enter away.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmPhrase,
  phraseHint = 'Type CONFIRM to enable this action',
  busy = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmPhrase: string;
  phraseHint?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [typed, setTyped] = useState('');
  const ready = typed.trim() === confirmPhrase;

  /* Reset the typed phrase whenever the dialog opens. This is React's documented
   * "adjust state while rendering when a prop changes" shape: doing it in an
   * effect would commit one frame where the previous, still-typed phrase left
   * the confirm button live for a freshly opened target. */
  const [opened, setOpened] = useState(open);
  if (opened !== open) {
    setOpened(open);
    if (open) setTyped('');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={AlertTriangle}
      tone="danger"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" icon={AlertTriangle} busy={busy} disabled={!ready} onClick={onConfirm}>
            {busy ? 'Processing...' : 'Confirm'}
          </Button>
        </>
      }
    >
      {children}
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
        <label htmlFor="confirm-phrase" className="block text-[10px] font-mono uppercase tracking-wider text-red-300">
          {phraseHint}
        </label>
        <input
          id="confirm-phrase"
          value={typed}
          onChange={event => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
          placeholder={confirmPhrase}
        />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Secrets
 * ------------------------------------------------------------------ */

/**
 * Credentials and onboarding tokens are masked until deliberately revealed and
 * are never persisted: previously the temporary password was printed in plain
 * text in the panel and the TOTP secret was pushed into a toast string.
 */
export function SecretField({
  label,
  value,
  mono = true,
  allowCopy = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
  allowCopy?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => setCopied(false));
  }, [value]);

  const masked = `${'•'.repeat(Math.min(value.length, 16))}`;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRevealed(current => !current)}
            aria-pressed={revealed}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {revealed ? 'Hide' : 'Reveal'}
          </button>
          {allowCopy && (
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <Copy className="h-3 w-3" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
      <p className={`mt-1 break-all text-xs ${mono ? 'font-mono' : ''} ${revealed ? 'text-emerald-300' : 'text-slate-500'}`}>
        {revealed ? value : masked}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Toast
 * ------------------------------------------------------------------ */

const TOAST_CLASSES: Record<Toast['tone'], string> = {
  success: 'border-emerald-500/40 bg-emerald-950/70 text-emerald-200',
  error: 'border-red-500/40 bg-red-950/70 text-red-200',
  info: 'border-cyan-500/40 bg-cyan-950/70 text-cyan-200',
};

export function ToastViewport({ toast, onDismiss }: { toast: Toast | null; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-fadeIn fixed bottom-6 left-1/2 z-50 flex max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 text-xs shadow-2xl backdrop-blur-xl ${TOAST_CLASSES[toast.tone]}`}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="opacity-70 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pagination
 * ------------------------------------------------------------------ */

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/70 px-5 py-3 text-xs"
    >
      <span className="font-mono text-slate-400">
        {from}–{to} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="font-mono text-slate-300">{page + 1} / {pageCount}</span>
        <Button variant="ghost" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ *
 * Form fields
 * ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>{label}{required && <span className="text-red-400"> *</span>}</span>
        {hint}
      </span>
      {children}
    </label>
  );
}

export const INPUT_CLASS =
  'w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none';
