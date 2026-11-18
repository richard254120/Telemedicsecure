/**
 * Role-agnostic HTTP transport shared by every dashboard.
 *
 * Rules this module enforces everywhere:
 *
 *  1. A non-2xx response is an *error*, never a silent empty array. An
 *     unreachable endpoint must not be renderable as "0 records".
 *  2. A 401 triggers one silent token-refresh attempt before the request is
 *     retried. Only if the refresh itself fails does the transport broadcast
 *     `telemed:auth-expired` to gate the UI.
 *  3. A 403 (forbidden, not expired) is surfaced immediately as an error
 *     without a refresh attempt, since re-authing won't change permissions.
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
 * Optional hook the transport can call to silently refresh the access token.
 * Set by AuthProvider on mount so transport can reach the refresh logic without
 * creating a circular module dependency.
 */
let _silentRefresh: (() => Promise<boolean>) | null = null;

export function registerSilentRefresh(fn: () => Promise<boolean>) {
  _silentRefresh = fn;
}

export function clearSilentRefresh() {
  _silentRefresh = null;
}

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
  return new ApiError(res.status, detail || `${fallback} (HTTP ${res.status})`, detail);
}

async function rawFetch(
  getAuthHeaders: HeadersFactory,
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...getAuthHeaders(),
    },
  });
}

export async function request<T>(
  getAuthHeaders: HeadersFactory,
  path: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  let res: Response;
  try {
    res = await rawFetch(getAuthHeaders, path, init);
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(0, `${fallbackMessage}: network unreachable`);
  }

  // ── 401 handling: attempt a silent refresh, then retry once ──────────────
  if (res.status === 401 && _silentRefresh) {
    const refreshed = await _silentRefresh();
    if (refreshed) {
      // Retry with the freshly rotated access token
      try {
        res = await rawFetch(getAuthHeaders, path, init);
      } catch (err) {
        if (isAbortError(err)) throw err;
        throw new ApiError(0, `${fallbackMessage}: network unreachable`);
      }
      if (!res.ok) {
        // Refresh worked but the endpoint still rejects — real auth failure
        broadcastAuthExpired();
        throw await parseError(res, fallbackMessage);
      }
    } else {
      // Refresh failed — session is gone
      broadcastAuthExpired();
      throw await parseError(res, fallbackMessage);
    }
  } else if (res.status === 401) {
    // No refresh hook registered (e.g. not logged in at all)
    broadcastAuthExpired();
    throw await parseError(res, fallbackMessage);
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
