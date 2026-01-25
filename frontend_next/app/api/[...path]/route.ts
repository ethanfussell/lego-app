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

function normalizePath(pathParam: unknown): string[] {
  if (Array.isArray(pathParam)) return pathParam.map(String);
  if (typeof pathParam === "string" && pathParam.length) return [pathParam];
  return [];
}

function fallbackPathFromUrl(req: NextRequest): string {
  // req.nextUrl.pathname is like: /api/sets/21355-1/reviews/me
  const p = req.nextUrl.pathname || "";
  const stripped = p.startsWith("/api/") ? p.slice("/api/".length) : p.replace(/^\/+/, "");
  return stripped;
}

function copyRequestHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);

  return h;
}

function copyResponseHeaders(resp: Response, proxyUrl: string) {
  const h = new Headers();

  const ct = resp.headers.get("content-type");
  if (ct) h.set("content-type", ct);

  const xtc = resp.headers.get("x-total-count");
  if (xtc) h.set("x-total-count", xtc);

  h.set("x-proxy-url", proxyUrl);
  h.set("x-hit", "api-[...path]");

  return h;
}

async function proxy(req: NextRequest, ctx: any) {
  const parts = normalizePath(ctx?.params?.path);

  // ✅ if Next fails to populate params, use the URL as truth
  const path = parts.length ? parts.join("/") : fallbackPathFromUrl(req);

  const proxyUrl = `${backendBase()}/${path}${req.nextUrl.search || ""}`;

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.text() : undefined;

  const resp = await fetch(proxyUrl, {
    method,
    headers: copyRequestHeaders(req),
    body,
    cache: "no-store",
  });

  if (resp.status === 204) {
    return new NextResponse(null, {
      status: 204,
      headers: copyResponseHeaders(resp, proxyUrl),
    });
  }

  const text = await resp.text();
  return new NextResponse(text, {
    status: resp.status,
    headers: copyResponseHeaders(resp, proxyUrl),
  });
}

export function GET(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export function POST(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export function PUT(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export function PATCH(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export function DELETE(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}