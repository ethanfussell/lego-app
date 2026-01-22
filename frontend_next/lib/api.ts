// frontend_next/lib/api.ts
export class APIError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, detail?: string) {
    super(`${status}${detail ? " " + detail : ""}`);
    this.name = "APIError";
    this.status = status;
    this.detail = detail;
  }
}

function apiBase() {
  // In the browser: use Next's same-origin proxy
  if (typeof window !== "undefined") return "/api";

  // On the server (Route Handlers / Server Components): you can still use the proxy too,
  // but if you *want* direct-to-backend SSR you can set API_BASE_URL.
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function buildUrl(path: string) {
  if (path.startsWith("http")) return path;

  const base = apiBase();

  // If we're using the proxy, ensure it starts with /api
  if (base === "/api") {
    // allow callers to pass "/api/..." or "/lists/me" etc.
    const p = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? "" : "/"}${path}`;
    return p;
  }

  // Direct backend mode
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

type ApiFetchOptions = Omit<RequestInit, "body" | "headers" | "method"> & {
  method?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {}
): Promise<T | null> {
  const url = buildUrl(path);

  const { method = "GET", token, body, headers = {}, ...rest } = opts;

  const finalHeaders: Record<string, string> = { ...headers };
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
    throw new APIError(resp.status, detail);
  }

  // 204 / empty body
  const text = await resp.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    // Some endpoints might return plain text
    return text as unknown as T;
  }
}