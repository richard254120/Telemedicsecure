/**
 * Role-agnostic HTTP transport shared by every dashboard.
 *
 * Two rules the naive `fetch(...).then(r => r.ok ? r.json() : [])` calls broke,
 * and that this module enforces everywhere (not just the admin console):
 *
 *  1. A non-2xx response is an *error*, never a silent empty array. An
 *     unreachable endpoint must not be renderable as "0 records".
 *  2. A 401/403 broadcasts `telemed:auth-expired` so the session can be
 *     terminated instead of leaving a stale operator on a blank HUD.
 */
import { API_BASE } from '../config';

export const AUTH_EXPIRED_EVENT = 'telemed:auth-expired';

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(status: number, message: string, detail: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }

  /** True when the response means "your session is no longer valid". */
  get isAuthFailure() {
    return this.status === 401 || this.status === 403;
  }
}

export type HeadersFactory = () => Record<string, string>;

/**
 * True for the rejection an AbortController produces. `fetch` rejects with a
 * DOMException (not an Error subclass every engine guarantees), so the name is
 * read structurally instead of via `err: any`.
 */
export function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

/** A message safe to show an operator, from a value of unknown shape. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function broadcastAuthExpired() {
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

async function parseError(res: Response, fallback: string): Promise<ApiError> {
  let detail: string | null = null;
  try {
    const body = await res.json();
    detail = (body && (body.error || body.message || body.details)) || null;
  } catch {
    detail = null;
  }
  if (res.status === 401 || res.status === 403) broadcastAuthExpired();
  return new ApiError(res.status, detail || `${fallback} (HTTP ${res.status})`, detail);
}

export async function request<T>(
  getAuthHeaders: HeadersFactory,
  path: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...getAuthHeaders(),
      },
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(0, `${fallbackMessage}: network unreachable`);
  }

  if (!res.ok) throw await parseError(res, fallbackMessage);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const get = <T>(h: HeadersFactory, path: string, msg: string, signal?: AbortSignal) =>
  request<T>(h, path, { method: 'GET', signal }, msg);

export const put = <T>(h: HeadersFactory, path: string, body: unknown, msg: string) =>
  request<T>(h, path, { method: 'PUT', body: JSON.stringify(body) }, msg);

export const post = <T>(h: HeadersFactory, path: string, body: unknown, msg: string) =>
  request<T>(h, path, { method: 'POST', body: JSON.stringify(body) }, msg);

export const patch = <T>(h: HeadersFactory, path: string, body: unknown, msg: string) =>
  request<T>(h, path, { method: 'PATCH', body: JSON.stringify(body) }, msg);

export const del = <T>(h: HeadersFactory, path: string, msg: string) =>
  request<T>(h, path, { method: 'DELETE' }, msg);
