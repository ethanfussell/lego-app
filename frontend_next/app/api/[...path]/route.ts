import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ✅ Next expects params to be a plain object, not a Promise
type RouteContext = {
  params: { path: string[] };
};

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const base = apiBase().replace(/\/+$/, "");
  const path = pathParts.map(encodeURIComponent).join("/");
  const url = `${base}/${path}${req.nextUrl.search}`;

  // ✅ Don’t forward the host header / vercel headers to your backend
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "application/json";
  const body = await res.arrayBuffer();

  return new NextResponse(body, {
    status: res.status,
    headers: {
      "content-type": contentType,
    },
  });
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  return proxy(req, params.path);
}
export async function POST(req: NextRequest, { params }: RouteContext) {
  return proxy(req, params.path);
}
export async function PUT(req: NextRequest, { params }: RouteContext) {
  return proxy(req, params.path);
}
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return proxy(req, params.path);
}
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  return proxy(req, params.path);
}
export async function OPTIONS(req: NextRequest, { params }: RouteContext) {
  return proxy(req, params.path);
}