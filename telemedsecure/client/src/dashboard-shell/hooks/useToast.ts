import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

/**
 * Replaces the `setActionMessage(...)` + bare `setTimeout(...)` pairs the old
 * component scattered across ~20 handlers. Those timers leaked (a second
 * message cancelled the *visibility* of the first but not its timer, and none
 * of them were cleared on unmount, writing state into a dead tree).
 */
export function useToast(defaultTtlMs = 5000) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setToast(null);
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = 'info', ttlMs = defaultTtlMs) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    seq.current += 1;
    const id = seq.current;
    setToast({ id, tone, message });
    if (ttlMs > 0) {
      timer.current = window.setTimeout(() => {
        timer.current = null;
        // Only clear the toast this timer owns.
        setToast(current => (current && current.id === id ? null : current));
      }, ttlMs);
    }
  }, [defaultTtlMs]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  return { toast, notify, dismiss };
}
