/**
 * CSV generation for exports that auditors open in spreadsheet software.
 *
 * Two defects in the previous exporter are fixed here:
 *
 *  1. It built a `data:text/csv,...` URI and ran `encodeURI` over the whole
 *     thing. Any value containing `%`, `#`, or non-ASCII text was corrupted or
 *     truncated, because `#` terminates a data URI and `%` starts an escape
 *     sequence. Exports now go through a Blob object URL that is revoked
 *     afterwards.
 *  2. It had no formula-injection defence. A record whose name begins with
 *     `=`, `+`, `-`, `@`, or a tab is executed by Excel on open, so a patient
 *     or a malicious invitee could plant `=HYPERLINK(...)` or `=cmd|...` in a
 *     field that later lands in an "official" audit dossier. String cells are
 *     now neutralised; genuine numbers are untouched.
 */

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\n'];

function neutralise(value: string): string {
  const needsGuard = value.length > 0 && FORMULA_PREFIXES.includes(value[0]);
  const body = needsGuard ? `'${value}` : value;
  // RFC 4180: quote when the field holds a delimiter, a quote, or a newline.
  const needsQuotes = needsGuard || /[",\r\n]/.test(value);
  return needsQuotes ? `"${body.replace(/"/g, '""')}"` : body;
}

export type CsvCell = string | number | boolean | null | undefined;

export function toCsvRow(cells: CsvCell[]): string {
  return cells.map(cell => {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : '';
    if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
    return neutralise(String(cell));
  }).join(',');
}

const UTF8_BOM = String.fromCharCode(0xfeff);

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  // CRLF line endings + UTF-8 BOM: Excel on Windows misreads plain UTF-8 CSV.
  const lines = [toCsvRow(headers), ...rows.map(toCsvRow)];
  return UTF8_BOM + lines.join('\r\n') + '\r\n';
}

export function csvFileName(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${prefix}-${stamp}.csv`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next tick so Safari has time to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
