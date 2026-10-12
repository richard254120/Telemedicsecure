/**
 * Global API and WebSocket connection configuration.
 * Automatically switches between local dev and deployed production (Render/Vercel)
 * using Vite environment variables: VITE_API_URL and VITE_WS_URL.
 * 
 * FOR CROSS-DEVICE ACCESS:
 * Set VITE_API_URL to your server's network IP, e.g.:
 * - VITE_API_URL=http://192.168.1.100:1000 (replace with your actual IP)
 * - VITE_WS_URL=http://192.168.1.100:1000
 * 
 * To find your IP on Linux/Mac: run `ip addr show` or `ifconfig`
 * To find your IP on Windows: run `ipconfig`
 * 
 * Note: Server runs on port 1000 (see server/.env)
 */
export const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:1000').replace(/\/+$/, '');
export const API_BASE = `${BACKEND_URL}/api/v1`;
export const WS_URL = (import.meta.env.VITE_WS_URL || BACKEND_URL).replace(/\/+$/, '');

// Log configuration for debugging
console.log('API Configuration:', { BACKEND_URL, API_BASE, WS_URL });
