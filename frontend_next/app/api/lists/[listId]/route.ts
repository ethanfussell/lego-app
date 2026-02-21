import { NextResponse } from "next/server";

export const revalidate = 3600;

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

export async function GET(_req: Request, { params }: { params: { listId: string } }) {
  const id = String(params.listId || "").trim();

  const url = `${apiBase()}/lists/${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=60",
    },
  });
}