// src/lib/api.js
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
const TOKEN_KEY = "lego_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

export async function apiFetch(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const {
    method = "GET",
    token = "",
    body,
    headers = {},
    ...rest
  } = opts;

  const finalHeaders = {
    ...headers,
  };

  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body != null) finalHeaders["Content-Type"] = "application/json";

  const resp = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (!resp.ok) {
    let detail = "";
    try {
      const data = await resp.json();
      detail = data?.detail ? String(data.detail) : JSON.stringify(data);
    } catch {
      try {
        detail = await resp.text();
      } catch {
        detail = "";
      }
    }
    throw new Error(`${resp.status}${detail ? " " + detail : ""}`);
  }

  // Some endpoints may return 204 or empty
  const text = await resp.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}