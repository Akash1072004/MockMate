/**
 * Centralized API base URL resolver.
 * Ensures code execution, evaluation, and interview endpoints work seamlessly on:
 * - Localhost (development machine)
 * - Remote physical devices on the same Wi-Fi / LAN (e.g. http://192.168.x.x:5173)
 * - Production builds with VITE_API_URL or Render backend fallback
 */
const PRODUCTION_RENDER_API = 'https://mockmate-backend-0vtt.onrender.com/api';

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    // 1. If explicit environment variable is provided
    if (import.meta.env?.VITE_API_URL) {
      const raw = import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '');
      return raw.endsWith('/api') ? raw : `${raw}/api`;
    }

    // 2. Check if running on localhost / loopback / local network development
    const hostname = window.location.hostname || '';
    const isLocalhost = Boolean(
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local')
    );

    if (isLocalhost) {
      // In local dev without explicit VITE_API_URL, use same-origin /api (proxied by Vite to http://localhost:5000)
      return '/api';
    }

    // 3. In production deployed environment (e.g. Vercel), route directly to Render backend
    return PRODUCTION_RENDER_API;
  }

  // Node.js fallback
  const fallback = (process.env.VITE_API_URL || PRODUCTION_RENDER_API).trim().replace(/\/+$/, '');
  return fallback.endsWith('/api') ? fallback : `${fallback}/api`;
}
