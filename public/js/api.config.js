const BACKEND_URL = "https://impish-harpist-parcel.ngrok-free.dev";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { ...DEFAULT_HEADERS, ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
  return res;
}
