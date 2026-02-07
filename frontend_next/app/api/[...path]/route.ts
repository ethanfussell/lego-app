// frontend_next/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: { path: string[] };
};

function apiBase(): string {
  // Server-side proxy should prefer non-public env var if you set it
  const base =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000";

  return base.replace(/\/+$/, "");
}

function stripHopByHopHeaders(h: Headers): Headers {
  const out = new Headers();

  // Copy only what you usually want to forward.
  // (You can add more if your backend needs them.)
  const allow = [
    "accept",
    "accept-language",
    "authorization",
    "content-type",
    "cookie",
    "user-agent",
    "x-forwarded-for",
    "x-forwarded-proto",
    "x-forwarded-host",
    "x-real-ip",
  ];

  for (const key of allow) {
    const v = h.get(key);
    if (v) out.set(key, v);
  }

  return out;
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const base = apiBase();
  const path = pathParts.map(encodeURIComponent).join("/");
  const url = `${base}/${path}${req.nextUrl.search}`;

  const method = req.method.toUpperCase();
  const headers = stripHopByHopHeaders(req.headers);

  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const upstream = await fetch(url, {
    method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });

  // Pass through body + important headers
  const resHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) resHeaders.set("content-type", ct);

  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) resHeaders.set("cache-control", cacheControl);

  // Optional: allow your frontend origin to call this route (usually same-origin anyway)
  // resHeaders.set("access-control-allow-origin", "*");

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function OPTIONS() {
  // Preflight – respond immediately
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
    },
  });
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path);
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path);
}