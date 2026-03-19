// frontend_next/app/api/themes/[theme]/subthemes/route.ts
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function GET(_req: Request, ctx: { params: Promise<{ theme: string }> | { theme: string } }) {
  const { theme } = await ctx.params;

  const upstream = `${API_BASE}/themes/${encodeURIComponent(theme)}/subthemes`;

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
