// frontend_next/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ path: string[] }>;
};

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "http://127.0.0.1:8000"
  );
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const base = apiBase().replace(/\/+$/, "");
  const path = pathParts.map(encodeURIComponent).join("/");
  const url = `${base}/${path}${req.nextUrl.search}`;

  // Clone headers so we can safely adjust a few
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.arrayBuffer();

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  const contentType = upstream.headers.get("content-type") || "application/json";
  const buf = await upstream.arrayBuffer();

  return new NextResponse(buf, {
    status: upstream.status,
    headers: {
      "content-type": contentType,
      // Optional but nice for debugging/proxies:
      "x-proxied-by": "next-route",
    },
  });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}