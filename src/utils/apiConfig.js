/**
 * Centralized API base URL resolver.
 * Ensures code execution, evaluation, and interview endpoints work seamlessly on:
 * - Localhost (development machine)
 * - Remote physical devices on the same Wi-Fi / LAN (e.g. http://192.168.x.x:5173)
 * - Production builds with VITE_API_URL (e.g. https://BACKEND.onrender.com/api)
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    if (import.meta.env?.VITE_API_URL) {
      const raw = import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '');
      return raw.endsWith('/api') ? raw : `${raw}/api`;
    }
    // In browser dev context without VITE_API_URL, use same-origin /api.
    // Vite's dev server proxies /api to http://localhost:5000.
    return '/api';
  }

  // Node.js fallback
  const fallback = (process.env.VITE_API_URL || 'http://localhost:5000/api').trim().replace(/\/+$/, '');
  return fallback.endsWith('/api') ? fallback : `${fallback}/api`;
}
