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

type Ctx = { params: Promise<{ id: string }> } | { params: { id: string } };

async function getId(ctx: Ctx) {
  const resolved = await Promise.resolve((ctx as any).params);
  return String(resolved?.id || "");
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const id = await getId(ctx);
  const body = await req.text();

  const url = `${backendBase()}/lists/${encodeURIComponent(id)}/items`;
  const resp = await fetch(url, {
    method: "POST",
    headers: passthroughHeaders(req),
    body,
    cache: "no-store",
  });

  const text = await resp.text();
  return new NextResponse(text, {
    status: resp.status,
    headers: { "content-type": resp.headers.get("content-type") || "application/json" },
  });
}