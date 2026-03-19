// frontend_next/app/api/sets/[setNum]/collection-stats/route.ts
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function GET(_req: Request, ctx: { params: Promise<{ setNum: string }> | { setNum: string } }) {
  const { setNum } = await ctx.params;

  const upstream = `${API_BASE}/sets/${encodeURIComponent(setNum)}/collection-stats`;

  const resp = await fetch(upstream, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  const text = await resp.text();

  return new NextResponse(text, {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") || "application/json; charset=utf-8",
    },
  });
}
