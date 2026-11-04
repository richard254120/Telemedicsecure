import { useEffect, useState } from 'react';

/**
 * A render-safe clock.
 *
 * `Date.now()` inside a component body is impure: React may re-render for any
 * reason and silently change relative times, lockout badges or expiry labels
 * under the user (and `react-hooks/purity` rightly rejects it). Components that
 * must show "3m ago" or "locked until" therefore read a tick that is produced by
 * a timer and committed through state, which keeps a single render consistent.
 *
 * The interval is deliberately coarse (30s default): these labels are relative
 * ages, not stopwatches, and the whole console must not wake up twice a second.
 */
export function useNow(intervalMs = 30_000): number {
  // The initializer only runs on the first render of this component, so the
  // value is stable for the lifetime of the mount until the timer moves it.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
