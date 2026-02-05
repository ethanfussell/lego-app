import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase(): string {
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e ?? "");
}

function passthroughHeaders(req: NextRequest): Headers {
  const h = new Headers();

  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  // We forward JSON bodies for ratings updates
  h.set("content-type", "application/json");
  return h;
}

function responseHeaders(contentType?: string | null): HeadersInit {
  return {
    "content-type": contentType || "application/json",
    "x-hit": "ratings-[set_num]",
  };
}

type Params = { set_num?: string };
type RouteCtx = { params: Params | Promise<Params> };

async function unwrapParams(ctx: RouteCtx): Promise<Params> {
  const p = ctx.params;
  return p instanceof Promise ? await p : p;
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  try {
    const params = await unwrapParams(ctx);

    let setNum = String(params?.set_num ?? "").trim();

    // fallback: /api/ratings/<set_num>
    if (!setNum) {
      const parts = req.nextUrl.pathname.split("/").filter(Boolean);
      setNum = String(parts.at(-1) ?? "").trim();
    }

    if (!setNum) {
      return new NextResponse(JSON.stringify({ detail: "Missing set_num" }), {
        status: 400,
        headers: responseHeaders(),
      });
    }

    const raw = await req.text();
    const body = raw.trim().length ? raw : "{}";

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