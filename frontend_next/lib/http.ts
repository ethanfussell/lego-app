// frontend_next/lib/http.ts
import type { JsonValue } from "./types";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type FetchJsonOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown; // will be JSON.stringified if provided
  cache?: RequestCache;
  signal?: AbortSignal;
};

export type HttpErrorInfo = {
  status: number;
  message: string;
  details?: unknown;
};

export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(info: HttpErrorInfo) {
    super(info.message);
    this.name = "HttpError";
    this.status = info.status;
    this.details = info.details;
  }
}

async function readResponseBody(res: Response): Promise<unknown> {
  // Some endpoints might not return JSON (or might return empty)
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    // not JSON — return raw text
    return text;
  }
}

export async function fetchJson(url: string, opts: FetchJsonOptions = {}): Promise<unknown> {
  const { method = "GET", headers, body, cache, signal } = opts;

  const res = await fetch(url, {
    method,
    headers: {
      ...(body != null ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
    cache,
    signal,
  });

  const data = await readResponseBody(res);

  if (!res.ok) {
    // Try to extract useful message if server provides it
    const msg =
      typeof data === "object" && data && "detail" in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).detail)
        : `Request failed (${res.status})`;

    throw new HttpError({ status: res.status, message: msg, details: data });
  }

  return data;
}