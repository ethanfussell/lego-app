import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const includeSystem = url.searchParams.get("include_system") ?? "false";

  const upstream = new URL("/lists/me", apiBase());
  upstream.searchParams.set("include_system", includeSystem);

  // Forward auth (and cookies if you ever switch to cookie auth)
  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  headers.set("accept", "application/json");

  const res = await fetch(upstream.toString(), {
    method: "GET",
    headers,
    cache: "no-store", // auth endpoint: never cache
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
      // auth endpoint: keep it private/no-store at the edge
      "cache-control": "private, no-store",
    },
  });
}
