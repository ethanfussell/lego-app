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

function originForServer(): string {
  if (process.env.NODE_ENV !== "production") {
    const port = process.env.PORT || "3000";
    return `http://localhost:${port}`;
  }

  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL || "";
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  return "http://localhost:3000";
}

function apiBase(): string {
  const useDirect = process.env.USE_DIRECT_BACKEND === "1" || process.env.USE_DIRECT_BACKEND === "true";

  if (useDirect) {
    return (
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://127.0.0.1:8000"
    );
  }

  if (typeof window === "undefined") {
    return `${originForServer()}/api`;
  }

  return "/api";
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function buildUrl(path: string) {
  if (!path) throw new Error("apiFetch: missing path");
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const base = apiBase();

  if (base.endsWith("/api") || base === "/api") {
    if (path.startsWith("/api/")) return joinUrl(base, path.replace(/^\/api/, ""));
    if (path === "/api") return base;
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

// Reads response body safely as unknown
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
  // FastAPI often returns { detail: ... }
  if (isRecord(body) && "detail" in body) return String((body as Record<string, unknown>).detail);
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return "";
  }
}

export async function apiFetch<T = unknown>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const url = buildUrl(path);

  const { method = "GET", token, body, headers = {}, ...rest } = opts;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const upper = method; // already constrained to HttpMethod
  const hasBody = body != null && upper !== "GET";

  if (hasBody && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const isJson = (finalHeaders["Content-Type"] || "").includes("application/json");

  const init: RequestInit = {
    method: upper,
    headers: finalHeaders,
    cache: "no-store",
    ...rest,
    ...(hasBody
      ? { body: isJson ? JSON.stringify(body) : String(body) }
      : {}),
  };

  const resp = await fetch(url, init);

  const data = await readBody(resp);

  if (!resp.ok) {
    throw new APIError(resp.status, errorDetailFromBody(data));
  }

  // If you rely on null for empty bodies, you can keep it:
  // but strict code is nicer if we just return `null as unknown as T` is NOT great.
  // Instead: if data is null, return it and let T include null when needed.
  return data as T;
}