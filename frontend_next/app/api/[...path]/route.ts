// frontend_next/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase() {
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  );
}

function normalizePath(p: unknown): string[] {
  if (Array.isArray(p)) return p.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof p === "string" && p.trim()) return [p.trim()];
  return [];
}

function fallbackPathFromUrl(req: NextRequest): string[] {
  // "/api/foo/bar" -> ["foo","bar"]
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const apiIdx = parts.indexOf("api");
  return apiIdx >= 0 ? parts.slice(apiIdx + 1) : parts.slice(1);
}

// ✅ Next 16: ctx.params can be a Promise
async function unwrapParams(ctx: any): Promise<any> {
  const p = ctx?.params;
  return p && typeof p.then === "function" ? await p : p;
}

function buildUpstreamHeaders(req: NextRequest) {
  // ✅ Copy ALL incoming headers (including Authorization), then remove unsafe ones.
  const h = new Headers(req.headers);

  // These should not be forwarded
  h.delete("host");
  h.delete("connection");
  h.delete("content-length");

  // If you ever see weird gzip/body issues through proxy, uncomment:
  // h.delete("accept-encoding");

  // ✅ Ensure Authorization survives even if some env strips/normalizes it
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  return h;
}

async function proxy(req: NextRequest, ctx: any) {
  const params = await unwrapParams(ctx);
  const parts = normalizePath(params?.path);

  const path = parts.length ? parts.join("/") : fallbackPathFromUrl(req).join("/");

  // Preserve query string
  const qs = req.nextUrl.search || "";
  const upstream = `${backendBase()}/${path}${qs}`;

  const init: RequestInit = {
    method: req.method,
    headers: buildUpstreamHeaders(req),
    cache: "no-store",
  };

  // Only attach body for methods that can have one
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const resp = await fetch(upstream, init);
  const body = await resp.text();

  // Forward content-type; optionally also expose X-Total-Count if your backend uses it.
  const outHeaders = new Headers();
  outHeaders.set("content-type", resp.headers.get("content-type") || "application/json");
  outHeaders.set("x-hit", "api-proxy");

  const total = resp.headers.get("x-total-count");
  if (total) outHeaders.set("x-total-count", total);

  return new NextResponse(body, {
    status: resp.status,
    headers: outHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;