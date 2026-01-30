// frontend_next/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBaseRaw() {
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
}

function normalizeParts(p: unknown): string[] {
  if (Array.isArray(p)) return p.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof p === "string" && p.trim()) return [p.trim()];
  return [];
}

function fallbackPartsFromUrl(req: NextRequest): string[] {
  // /api/<...> -> take everything after "api"
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const apiIdx = parts.indexOf("api");
  return apiIdx >= 0 ? parts.slice(apiIdx + 1) : parts.slice(1);
}

// Next 16: ctx.params can be a Promise
async function unwrapParams(ctx: any): Promise<any> {
  const p = ctx?.params;
  return p && typeof p.then === "function" ? await p : p;
}

function assertNotProxyingToSelf(req: NextRequest, base: string) {
  // prevent accidental recursion if API_BASE_URL points at the same host as the Next app
  try {
    const baseUrl = new URL(base);
    const curUrl = new URL(req.url);
    if (baseUrl.host === curUrl.host) {
      throw new Error(
        `Proxy recursion: API_BASE_URL/NEXT_PUBLIC_API_BASE_URL points to this app (${baseUrl.host}). Set it to the FastAPI host.`
      );
    }
  } catch {
    // ignore parse issues
  }
}

function buildUpstreamHeaders(req: NextRequest) {
  const h = new Headers(req.headers);

  // hop-by-hop headers (don’t forward)
  h.delete("host");
  h.delete("connection");
  h.delete("content-length");

  // optional: avoid weird compression interactions
  h.delete("accept-encoding");

  // Ensure Authorization survives (some runtimes can lowercase/normalize)
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  return h;
}

async function proxy(req: NextRequest, ctx: any) {
  const base = backendBaseRaw();
  assertNotProxyingToSelf(req, base);

  const params = await unwrapParams(ctx);
  const parts = normalizeParts(params?.path);
  const path = (parts.length ? parts : fallbackPartsFromUrl(req)).join("/");

  const qs = req.nextUrl.search || "";
  const upstream = `${base}/${path}${qs}`;

  const init: RequestInit = {
    method: req.method,
    headers: buildUpstreamHeaders(req),
    cache: "no-store",
  };

  // Forward raw body bytes if present (safe for JSON, form, etc.)
  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) init.body = buf;
  }

  const resp = await fetch(upstream, init);

  const outHeaders = new Headers();
  outHeaders.set("x-hit", "api-proxy");
  outHeaders.set("x-proxy-version", "204fix-v3");

  // pass through useful headers
  const ct = resp.headers.get("content-type");
  if (ct) outHeaders.set("content-type", ct);

  const total = resp.headers.get("x-total-count");
  if (total) outHeaders.set("x-total-count", total);

  // 204/205/304 must not include a body
  if (resp.status === 204 || resp.status === 205 || resp.status === 304) {
    return new NextResponse(null, { status: resp.status, headers: outHeaders });
  }

  // Stream the upstream response through (don’t re-encode as text)
  return new NextResponse(resp.body, { status: resp.status, headers: outHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;