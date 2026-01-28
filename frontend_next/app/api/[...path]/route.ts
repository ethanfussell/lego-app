import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase() {
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
}

function normalizePath(p: unknown): string[] {
  if (Array.isArray(p)) return p.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof p === "string" && p.trim()) return [p.trim()];
  return [];
}

function fallbackPathFromUrl(req: NextRequest): string[] {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const apiIdx = parts.indexOf("api");
  return apiIdx >= 0 ? parts.slice(apiIdx + 1) : parts.slice(1);
}

// Next 16: ctx.params can be a Promise
async function unwrapParams(ctx: any): Promise<any> {
  const p = ctx?.params;
  return p && typeof p.then === "function" ? await p : p;
}

function buildUpstreamHeaders(req: NextRequest) {
  const h = new Headers(req.headers);

  // Don't forward hop-by-hop / unsafe headers
  h.delete("host");
  h.delete("connection");
  h.delete("content-length");

  // Ensure Authorization survives
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  return h;
}

function requestHasBody(req: NextRequest): boolean {
  const cl = req.headers.get("content-length");
  if (cl && cl !== "0") return true;
  if (req.headers.get("transfer-encoding")) return true;
  return false;
}

async function proxy(req: NextRequest, ctx: any) {
  try {
    const params = await unwrapParams(ctx);
    const parts = normalizePath(params?.path);

    const path = parts.length ? parts.join("/") : fallbackPathFromUrl(req).join("/");
    const qs = req.nextUrl.search || "";
    const upstream = `${backendBase()}/${path}${qs}`;

    const init: RequestInit = {
      method: req.method,
      headers: buildUpstreamHeaders(req),
      cache: "no-store",
    };

    // Only forward a body if one is actually present
    if (req.method !== "GET" && req.method !== "HEAD" && requestHasBody(req)) {
      init.body = await req.text();
    }

    const resp = await fetch(upstream, init);

    const outHeaders = new Headers();
    outHeaders.set("x-hit", "api-proxy");
    outHeaders.set("x-proxy-version", "204fix-v2");

    const total = resp.headers.get("x-total-count");
    if (total) outHeaders.set("x-total-count", total);

    // 204/205/304 must not include a body
    if (resp.status === 204 || resp.status === 205 || resp.status === 304) {
      return new NextResponse(null, { status: resp.status, headers: outHeaders });
    }

    const contentType = resp.headers.get("content-type");
    if (contentType) outHeaders.set("content-type", contentType);

    const body = await resp.text();
    return new NextResponse(body, { status: resp.status, headers: outHeaders });
  } catch (e: any) {
    // If we still crash, return a JSON error *with* x-hit so we know it came from the proxy.
    const outHeaders = new Headers();
    outHeaders.set("x-hit", "api-proxy");
    outHeaders.set("x-proxy-version", "204fix-v2");
    return NextResponse.json(
      { detail: "proxy_error", error: String(e?.message || e) },
      { status: 502, headers: outHeaders }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
