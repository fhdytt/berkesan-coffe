// Backend API URL — ganti jika URL Railway berubah
const BACKEND_URL = "https://sublime-laughter-production.up.railway.app";

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
