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

/**
 * Base for API requests.
 *
 * Default behavior:
 * - Browser: always same-origin proxy via /api (Next route handler forwards to FastAPI)
 * - Server: also /api (works in dev + Vercel). If you *really* want direct backend,
 *   set API_BASE_URL or NEXT_PUBLIC_API_BASE_URL and set USE_DIRECT_BACKEND="1".
 */
function apiBase(): string {
  const useDirect =
    process.env.USE_DIRECT_BACKEND === "1" ||
    process.env.USE_DIRECT_BACKEND === "true";

  if (!useDirect) return "/api";

  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  );
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * Convert caller paths into the correct URL:
 * - If base === "/api": ensure URL begins with "/api/..."
 * - If direct backend: join base + path
 */
function buildUrl(path: string) {
  if (!path) throw new Error("apiFetch: missing path");
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const base = apiBase();

  // Proxy mode (Next API route)
  if (base === "/api") {
    // allow "/reviews/me" or "/api/reviews/me"
    if (path.startsWith("/api/")) return path;
    if (path === "/api") return "/api";
    return path.startsWith("/") ? `/api${path}` : `/api/${path}`;
  }

  // Direct backend mode
  return joinUrl(base, path);
}

type ApiFetchOptions = Omit<RequestInit, "body" | "headers" | "method"> & {
  method?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function readErrorDetail(resp: Response): Promise<string> {
  try {
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data: any = await resp.json();
      if (data?.detail != null) return String(data.detail);
      return JSON.stringify(data);
    }
  } catch {
    // ignore JSON parse errors
  }

  try {
    return await resp.text();
  } catch {
    return "";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {}
): Promise<T | null> {
  const url = buildUrl(path);

  const {
    method = "GET",
    token,
    body,
    headers = {},
    ...rest
  } = opts;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const upper = method.toUpperCase();
  const hasBody = body != null && upper !== "GET" && upper !== "HEAD";

  if (hasBody && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const resp = await fetch(url, {
    method: upper,
    headers: finalHeaders,
    body: hasBody
      ? finalHeaders["Content-Type"]?.includes("application/json")
        ? JSON.stringify(body)
        : (body as any)
      : undefined,
    cache: "no-store",
    ...rest,
  });

  if (!resp.ok) {
    const detail = await readErrorDetail(resp);
    throw new APIError(resp.status, detail);
  }

  // No content
  if (resp.status === 204 || resp.status === 205) return null;

  // Prefer json when available, otherwise fall back to text
  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    // can still throw on empty body; guard it
    const text = await resp.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      // if backend returned invalid JSON with JSON content-type, return raw
      return text as unknown as T;
    }
  }

  const text = await resp.text();
  if (!text) return null;
  return text as unknown as T;
}