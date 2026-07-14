/**
 * api.config.js — Konfigurasi URL backend terpusat
 *
 * Ganti nilai BACKEND_URL di bawah dengan URL Railway setelah deploy:
 *   const BACKEND_URL = "https://berkesan-production.up.railway.app";
 *
 * Untuk development lokal, ubah ke:
 *   const BACKEND_URL = "http://localhost:3000";
 */

// Baca dari <meta name="api-url"> di HTML, fallback ke localhost untuk dev lokal
const metaApiUrl = document.querySelector('meta[name="api-url"]');
const BACKEND_URL = (metaApiUrl && metaApiUrl.getAttribute('content'))
  ? metaApiUrl.getAttribute('content').replace(/\/$/, '') // hapus trailing slash
  : "http://localhost:3000";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

// Expose sebagai window.API_URL agar kompatibel dengan semua JS di project
window.API_URL = BACKEND_URL;

/**
 * Helper fetch dengan auto-inject Authorization header
 * Kompatibel dengan panggilan window.apiFetch() di seluruh JS
 */
window.apiFetch = async function (path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    ...DEFAULT_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  return fetch(`${BACKEND_URL}${path}`, { ...options, headers });
};
