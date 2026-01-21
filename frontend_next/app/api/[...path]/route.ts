import type { NextRequest } from "next/server";

const BACKEND_BASE = process.env.BACKEND_BASE_URL || "http://localhost:8000";

// Strip hop-by-hop headers that should not be forwarded
function cleanRequestHeaders(headers: Headers) {
  const h = new Headers(headers);
  h.delete("host");
  h.delete("connection");
  h.delete("content-length");
  h.delete("accept-encoding");
  h.delete("sec-fetch-mode");
  h.delete("sec-fetch-site");
  h.delete("sec-fetch-dest"); // let node handle it
  return h;
}

// Strip hop-by-hop response headers too
function cleanResponseHeaders(headers: Headers) {
  const h = new Headers(headers);
  h.delete("connection");
  h.delete("content-encoding");
  h.delete("transfer-encoding");
  return h;
}

async function proxy(req: NextRequest) {
  // Example: /api/sets -> /sets
  const incomingUrl = req.nextUrl;
  const pathAfterApi = incomingUrl.pathname.replace(/^\/api/, "") || "/";
  const targetUrl = `${BACKEND_BASE}${pathAfterApi}${incomingUrl.search}`;

  const method = req.method.toUpperCase();

  // Only include a body for methods that can have one
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const upstreamResp = await fetch(targetUrl, {
    method,
    headers: cleanRequestHeaders(req.headers),
    body,
    redirect: "manual",
  });

  const respHeaders = cleanResponseHeaders(upstreamResp.headers);

  // IMPORTANT: keep X-Total-Count for pagination
  // (it will already be present if backend returns it)
  // Next will forward these back to the browser.

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: respHeaders,
  });
}


export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;