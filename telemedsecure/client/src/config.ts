/**
 * Global API and WebSocket connection configuration.
 * Automatically switches between local dev and deployed production (Render/Vercel)
 * using Vite environment variables: VITE_API_URL and VITE_WS_URL.
 */
export const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
export const API_BASE = `${BACKEND_URL}/api/v1`;
export const WS_URL = (import.meta.env.VITE_WS_URL || BACKEND_URL).replace(/\/+$/, '');
