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

function passthroughHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  // forward content-type only if present (GETs won’t have one)
  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);

  return h;
}

async function proxy(req: NextRequest, ctx: any) {
  const params = await unwrapParams(ctx);
  const parts = normalizePath(params?.path);

  // if Next doesn't populate params for some reason, use URL as truth
  const path = parts.length ? parts.join("/") : fallbackPathFromUrl(req).join("/");

  const url = new URL(req.nextUrl.toString());
  const qs = url.search ? url.search : "";

  const upstream = `${backendBase()}/${path}${qs}`;

  const init: RequestInit = {
    method: req.method,
    headers: passthroughHeaders(req),
    cache: "no-store",
  };

  // Only attach body for methods that can have one
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const resp = await fetch(upstream, init);
  const body = await resp.text();

  return new NextResponse(body, {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") || "application/json",
      "x-hit": "api-proxy",
    },
  });
}

export async function GET(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function OPTIONS(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}