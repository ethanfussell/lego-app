// frontend_next/app/api/themes/[theme]/sets/route.ts
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function GET(req: Request, ctx: { params: Promise<{ theme: string }> | { theme: string } }) {
  const { theme } = await ctx.params;

  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  // Backend endpoint
  const upstream = `${API_BASE}/themes/${encodeURIComponent(theme)}/sets${qs ? `?${qs}` : ""}`;

  const resp = await fetch(upstream, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await resp.text();

  // Return body as-is (usually JSON). If backend returns HTML/error, you'll see it.
  const out = new NextResponse(text, {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") || "application/json; charset=utf-8",
    },
  });

  // Forward useful headers
  const total = resp.headers.get("x-total-count") || resp.headers.get("X-Total-Count");
  if (total) out.headers.set("x-total-count", total);

  return out;
}