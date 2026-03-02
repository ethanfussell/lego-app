// frontend_next/app/api/[...path]/route.ts
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic"; // never cache this proxy

function upstreamBase(): string {
  return (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
}

function buildUpstreamUrl(req: NextRequest, pathParts: string[], base: string): string {
  const upstreamPath = "/" + (pathParts || []).map(encodeURIComponent).join("/");
  const url = new URL(req.url);
  return `${base}${upstreamPath}${url.search || ""}`;
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const base = upstreamBase();

  if (!base) {
    return new Response(JSON.stringify({ detail: "Missing API_BASE_URL / NEXT_PUBLIC_API_BASE_URL" }), {
      status: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const { path = [] } = await ctx.params;
  const upstreamUrl = buildUpstreamUrl(req, path, base);

  // Copy headers (esp Authorization) but drop hop-by-hop-ish headers
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ detail: `Upstream fetch failed: ${msg}` }), {
      status: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  // 204/205 MUST NOT include a body
  if (upstreamRes.status === 204 || upstreamRes.status === 205) {
    const h = new Headers(upstreamRes.headers);
    h.delete("content-encoding");
    h.delete("content-length");
    h.set("cache-control", "no-store");
    h.set("vary", "authorization");
    h.set("x-proxy-upstream", upstreamUrl);
    h.set("x-proxy-status", String(upstreamRes.status));
    return new Response(null, { status: upstreamRes.status, headers: h });
  }

  const buf = await upstreamRes.arrayBuffer();

  const outHeaders = new Headers(upstreamRes.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");

  // auth-safe, non-cacheable
  outHeaders.set("cache-control", "no-store");
  outHeaders.set("vary", "authorization");

  // debug helpers
  outHeaders.set("x-proxy-upstream", upstreamUrl);
  outHeaders.set("x-proxy-status", String(upstreamRes.status));

  return new Response(buf, { status: upstreamRes.status, headers: outHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;