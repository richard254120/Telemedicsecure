import { useEffect, useState } from 'react';

/**
 * Debounce a fast-changing value (the workforce search box fires a keystroke
 * far more often than the table can meaningfully re-filter).
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
