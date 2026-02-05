// frontend_next/app/api/ratings/[set_num]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase(): string {
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  );
}

function errorMessage(e: unknown, fallback = "Unknown error"): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return fallback;
  }
}

function passthroughHeaders(req: NextRequest): Headers {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  // Always send JSON to backend for rating PUT
  h.set("content-type", "application/json");
  return h;
}

function responseHeaders(contentType?: string | null): Record<string, string> {
  return {
    "content-type": contentType || "application/json",
    "x-hit": "ratings-[set_num]",
  };
}

// Next 16+: params can be Promise-wrapped during build
type RouteCtx = {
  params: Promise<{ set_num?: string }>;
};

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  try {
    const params = await ctx.params;

    let setNum = String(params?.set_num || "").trim();

    // fallback: grab last path segment from /api/ratings/<set_num>
    if (!setNum) {
      const parts = req.nextUrl.pathname.split("/").filter(Boolean);
      setNum = String(parts[parts.length - 1] || "").trim();
    }

    if (!setNum) {
      return new NextResponse(JSON.stringify({ detail: "Missing set_num" }), {
        status: 400,
        headers: responseHeaders(),
      });
    }

    const raw = await req.text();
    const body = raw && raw.trim().length ? raw : "{}";

    const url = `${backendBase()}/ratings/${encodeURIComponent(setNum)}`;

    const resp = await fetch(url, {
      method: "PUT",
      headers: passthroughHeaders(req),
      body,
      cache: "no-store",
    });

    const text = await resp.text();
    return new NextResponse(text, {
      status: resp.status,
      headers: responseHeaders(resp.headers.get("content-type")),
    });
  } catch (e: unknown) {
    return new NextResponse(
      JSON.stringify({
        detail: "ratings proxy crashed",
        error: errorMessage(e),
      }),
      { status: 500, headers: responseHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "x-hit": "ratings-[set_num]" },
  });
}