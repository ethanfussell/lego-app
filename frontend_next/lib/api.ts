// frontend_next/lib/api.ts
import type { JsonValue } from "./types";
import { isRecord } from "./types";

export class APIError extends Error {
  status: number;
  detail: string | undefined;

  constructor(status: number, detail?: string) {
    super(`${status}${detail ? " " + detail : ""}`);
    this.name = "APIError";
    this.status = status;
    this.detail = detail;
  }
}

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * If someone sets NEXT_PUBLIC_API_BASE_URL=http://localhost (no port),
 * we almost always mean the FastAPI dev server on :8000.
 */
function normalizeLocalhostBase(raw: string): string {
  const s = stripTrailingSlashes(raw.trim());
  if (!s) return s;

  // http(s)://localhost  (no port)
  if (/^https?:\/\/localhost$/i.test(s)) return `${s}:8000`;

  // http(s)://127.0.0.1  (no port)
  if (/^https?:\/\/127\.0\.0\.1$/i.test(s)) return `${s}:8000`;

  return s;
}

/**
 * Server-side (RSC / route handlers): go straight to backend.
 * Browser: use Next proxy (/api) to avoid CORS.
 */
function apiBase(): string {
  const raw =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000";

  const direct = normalizeLocalhostBase(raw);

  if (typeof window === "undefined") return stripTrailingSlashes(direct);
  return "/api";
}

function joinUrl(base: string, path: string): string {
  const b = stripTrailingSlashes(base);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function buildUrl(path: string): string {
  if (!path) throw new Error("apiFetch: missing path");
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const base = apiBase();

  // If base is /api or .../api, avoid double-prefixing /api
  if (base === "/api" || base.endsWith("/api")) {
    if (path === "/api") return base;
    if (path.startsWith("/api/")) return joinUrl(base, path.replace(/^\/api/, ""));
    return joinUrl(base, path);
  }

  return joinUrl(base, path);
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiFetchOptions = Omit<RequestInit, "body" | "headers" | "method"> & {
  method?: HttpMethod;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function readBody(resp: Response): Promise<unknown> {
  const text = await resp.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return text;
  }
}

function errorDetailFromBody(body: unknown): string {
  if (isRecord(body) && "detail" in body) return String((body as Record<string, unknown>).detail);
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return "";
  }
}

function logIfHtmlOrError(resp: Response, body: unknown) {
  const ct = resp.headers.get("content-type") || "";
  const isHtml =
    ct.includes("text/html") ||
    (typeof body === "string" && body.trim().startsWith("<!DOCTYPE html"));

  if (resp.ok && !isHtml) return;

  const preview =
    typeof body === "string"
      ? body.slice(0, 180)
      : (() => {
          try {
            return JSON.stringify(body).slice(0, 180);
          } catch {
            return "";
          }
        })();

  // eslint-disable-next-line no-console
  console.error("[apiFetch] bad response", {
    url: resp.url,
    status: resp.status,
    contentType: ct,
    preview,
  });
}

function buildInit(opts: ApiFetchOptions): RequestInit {
  const { method = "GET", token, body, headers = {}, ...rest } = opts;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const upper: HttpMethod = method;
  const hasBody = body != null && upper !== "GET";

  if (hasBody && !finalHeaders["Content-Type"]) finalHeaders["Content-Type"] = "application/json";

  const isJson = (finalHeaders["Content-Type"] || "").includes("application/json");

  return {
    method: upper,
    headers: finalHeaders,
    cache: "no-store",
    ...rest,
    ...(hasBody ? { body: isJson ? JSON.stringify(body) : String(body) } : {}),
  };
}

/**
 * Standard JSON fetch. Existing callers keep working.
 */
export async function apiFetch<T = unknown>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const url = buildUrl(path);
  const resp = await fetch(url, buildInit(opts));
  const data = await readBody(resp);

  logIfHtmlOrError(resp, data);

  if (!resp.ok) throw new APIError(resp.status, errorDetailFromBody(data));
  return data as T;
}

/**
 * JSON fetch + return response headers (useful for pagination: X-Total-Count).
 */
export async function apiFetchWithHeaders<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {}
): Promise<{ data: T; headers: Headers }> {
  const url = buildUrl(path);
  const resp = await fetch(url, buildInit(opts));
  const data = await readBody(resp);

  logIfHtmlOrError(resp, data);

  if (!resp.ok) throw new APIError(resp.status, errorDetailFromBody(data));
  return { data: data as T, headers: resp.headers };
}

/**
 * Small helper for the common pattern.
 */
export function getTotalCount(headers: Headers): number | null {
  const raw = headers.get("x-total-count") ?? headers.get("X-Total-Count");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}