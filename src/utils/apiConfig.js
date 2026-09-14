/**
 * Centralized API base URL resolver.
 * Ensures code execution, evaluation, and interview endpoints work seamlessly on:
 * - Localhost (development machine)
 * - Remote physical devices on the same Wi-Fi / LAN (e.g. http://192.168.x.x:5173)
 * - Production builds with VITE_API_URL
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    if (import.meta.env?.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    // In browser context, use same-origin /api.
    // Vite's dev server proxies /api to http://localhost:5000.
    // This allows any device accessing http://192.168.x.x:5173 to reach the backend
    // without hitting the device's own localhost or failing CORS!
    return '/api';
  }

  // Node.js fallback
  return process.env.VITE_API_URL || 'http://localhost:5000/api';
}
