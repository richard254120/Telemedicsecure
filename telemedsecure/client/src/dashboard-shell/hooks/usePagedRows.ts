import { useMemo, useState } from 'react';

/**
 * Client-side windowing for the console's tables.
 *
 * The workforce directory, Rx ledger, and SMS log all rendered every row the
 * API returned into one `<tbody>`; with a few thousand audit events that cost
 * hundreds of milliseconds per keystroke in the search box. Filtering stays
 * memoised against the debounced query and only the current page is mounted.
 *
 * The page index is clamped whenever the filtered set shrinks, so a filter that
 * removes the current page's rows lands on the last valid page instead of an
 * empty table.
 */
export function usePagedRows<T>(rows: T[], pageSize = 25) {
  const [requestedPage, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  /* Clamped while rendering rather than in an effect: an effect would first
   * commit one frame of an empty table for the out-of-range page, and calling
   * setState synchronously in an effect is exactly the cascading render React
   * asks us to avoid. */
  const page = Math.min(requestedPage, pageCount - 1);

  const visible = useMemo(
    () => rows.slice(page * pageSize, page * pageSize + pageSize),
    [rows, page, pageSize],
  );

  return { page, pageCount, visible, setPage, total: rows.length };
}
