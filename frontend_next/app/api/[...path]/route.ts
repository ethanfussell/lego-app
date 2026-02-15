// frontend_next/app/api/[...path]/route.ts
import { NextRequest } from "next/server";

const UPSTREAM = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/+$/, "");

function buildUpstreamUrl(req: NextRequest, pathParts: string[]) {
  const upstreamPath = "/" + pathParts.map(encodeURIComponent).join("/");
  const url = new URL(req.url);
  const qs = url.search ? url.search : "";
  return `${UPSTREAM}${upstreamPath}${qs}`;
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!UPSTREAM) {
    return new Response(JSON.stringify({ detail: "Missing NEXT_PUBLIC_API_BASE_URL" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const { path } = await ctx.params;
  const upstreamUrl = buildUpstreamUrl(req, path || []);

  // Copy headers (esp Authorization)
  const headers = new Headers(req.headers);
  headers.delete("host");

  // Only pass a body for methods that can have one
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  const upstreamRes = await fetch(upstreamUrl, {
    method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: "manual",
  });

  // IMPORTANT: 204/205 MUST NOT read body
  if (upstreamRes.status === 204 || upstreamRes.status === 205) {
    return new Response(null, { status: upstreamRes.status });
  }

  // Passthrough body bytes (works for JSON + non-JSON)
  const buf = await upstreamRes.arrayBuffer();

  // Copy response headers, but avoid problematic ones
  const outHeaders = new Headers(upstreamRes.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");

  return new Response(buf, {
    status: upstreamRes.status,
    headers: outHeaders,
  });
}

// Export handlers for the methods you use
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;