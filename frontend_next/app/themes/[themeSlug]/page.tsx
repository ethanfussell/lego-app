// app/themes/[themeSlug]/page.tsx
import { notFound } from "next/navigation";
import ThemeDetailClient from "./ThemeDetailClient";

type SP = Record<string, string | string[] | undefined>;

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function first(sp: SP, key: string): string {
  const raw = sp[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v ?? "").trim();
}

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default async function ThemeSetsPage({
  params,
  searchParams,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
  searchParams?: SP | Promise<SP>;
}) {
  const { themeSlug } = await params;
  const sp = (await searchParams) ?? ({} as SP);

  const theme = decodeURIComponent(themeSlug);

  const page = toInt(first(sp, "page") || "1", 1);

  const limitRaw = toInt(first(sp, "limit") || "36", 36);
  const limit = clampInt(limitRaw, 1, 72);
  function clampInt(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
  }
  
  const sort = first(sp, "sort") || "relevance";
  const order = first(sp, "order") || "desc";
  
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("limit", String(limit));
  
  // only send sort if not default
  if (sort && sort !== "relevance") q.set("sort", sort);
  
  // only send order if not default for the sort
  const defaultOrder = sort === "name" ? "asc" : "desc";
  if (order && order !== defaultOrder) q.set("order", order);
  
  const url = `${apiBase()}/themes/${encodeURIComponent(theme)}/sets?${q.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) notFound();

  const data: unknown = await res.json();
  const initialSets = Array.isArray(data) ? data : [];

  // If theme doesn't exist / returns empty on page 1, treat as invalid
  if (page === 1 && initialSets.length === 0) notFound();

  return <ThemeDetailClient themeSlug={themeSlug} initialSets={initialSets} />;
}