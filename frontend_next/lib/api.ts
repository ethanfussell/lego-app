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
  // Browser: always go through Next proxy (same-origin)
  if (typeof window !== "undefined") return "/api";

  // Server: you can still use the proxy; direct backend is optional via env
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000"
  );
}

function buildUrl(path: string) {
  if (path.startsWith("http")) return path;

  const base = apiBase();

  // Proxy mode
  if (base === "/api") {
    // allow callers to pass "/api/..." or "/foo"
    const p = path.startsWith("/api")
      ? path
      : `/api${path.startsWith("/") ? "" : "/"}${path}`;
    return p;
  }

  // Direct backend mode
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
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

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const hasBody = body != null && method !== "GET" && method !== "HEAD";

  if (hasBody) finalHeaders["Content-Type"] = "application/json";

  const resp = await fetch(url, {
    method,
    headers: finalHeaders,
    body: hasBody ? JSON.stringify(body) : undefined,
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
    return text as unknown as T;
  }
}