// frontend_next/app/api/lists/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase() {
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  );
}

function passthroughHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);

  return h;
}

async function forward(req: NextRequest, id: string, methodOverride?: string) {
  const url = `${backendBase()}/lists/${encodeURIComponent(id)}${req.nextUrl.search}`;
  const method = (methodOverride || req.method).toUpperCase();

  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.text() : undefined;

  const resp = await fetch(url, {
    method,
    headers: passthroughHeaders(req),
    body,
    cache: "no-store",
  });

  const text = await resp.text();
  return new NextResponse(text, {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") || "application/json",
    },
  });
}

type Ctx = { params: Promise<{ id: string }> } | { params: { id: string } };

async function getId(ctx: Ctx) {
  const p: any = (ctx as any).params;
  const resolved = await Promise.resolve(p);
  return String(resolved?.id || "");
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const id = await getId(ctx);
  return forward(req, id, "GET");
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const id = await getId(ctx);
  return forward(req, id, "PATCH");
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const id = await getId(ctx);
  return forward(req, id, "DELETE");
}