// frontend_next/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prefer server-only env var if you have it; fall back to public env var.
function apiBase(): string {
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000"
  ).replace(/\/+$/, "");
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const upstreamPath = "/" + path.map((p) => encodeURIComponent(p)).join("/");

  const upstreamUrl = new URL(apiBase() + upstreamPath);

  // copy query string (?x=y)
  const reqUrl = new URL(req.url);
  reqUrl.searchParams.forEach((v, k) => upstreamUrl.searchParams.append(k, v));

  // forward headers (but remove hop-by-hop / problematic ones)
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  // Only send a body for methods that can have one
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const upstreamRes = await fetch(upstreamUrl.toString(), {
    method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });

  // Pass through response body + status
  const resBody = await upstreamRes.arrayBuffer();

  const resHeaders = new Headers(upstreamRes.headers);
  // avoid Next/Vercel compression/header weirdness
  resHeaders.delete("content-encoding");
  resHeaders.delete("content-length");

  // Helpful debug header to confirm which upstream we hit
  resHeaders.set("x-upstream-url", upstreamUrl.toString());

  return new NextResponse(resBody, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}

// Export ALL common verbs so Next doesn't 405 them.
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
export function OPTIONS(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}