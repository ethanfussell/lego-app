// frontend_next/app/api/lists/[listId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { apiBase } from "@/lib/api";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ listId: string }> }
) {
  const { listId } = await ctx.params;
  const id = String(listId || "").trim();

  const url = `${apiBase()}/lists/${encodeURIComponent(id)}`;

  // Forward auth so private lists are accessible
  const headers: Record<string, string> = { accept: "application/json" };
  const auth = req.headers.get("authorization");
  if (auth) headers["authorization"] = auth;

  const isAuthed = Boolean(auth);

  const res = await fetch(url, {
    headers,
    cache: isAuthed ? "no-store" : undefined,
    ...(!isAuthed ? { next: { revalidate: 3600 } } : {}),
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": isAuthed
        ? "private, no-store"
        : "public, max-age=0, s-maxage=3600, stale-while-revalidate=60",
    },
  });
}