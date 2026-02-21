// frontend_next/app/api/lists/public/route.ts
import { NextResponse } from "next/server";

export const revalidate = 3600;

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = (url.searchParams.get("owner") ?? "").trim();

  const upstream = new URL("/lists/public", apiBase());
  if (owner) upstream.searchParams.set("owner", owner);

  const res = await fetch(upstream.toString(), {
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  const body = await res.text();

  return new NextResponse(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
      // good caching on Vercel edge
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}