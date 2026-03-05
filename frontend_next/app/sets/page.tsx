// frontend_next/app/sets/page.tsx
import type { Metadata } from "next";
import SearchClient from "../search/SearchClient";
import { siteBase } from "@/lib/url";
import { unwrapSearchParams, first, type SP } from "@/lib/searchParams";

function parsePositiveInt(raw: string, fallback = 1): number {
  const n = Number(raw || "");
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SP> | SP;
}): Promise<Metadata> {
  const sp = await unwrapSearchParams(searchParams);
  const page = parsePositiveInt(first(sp, "page") || "1", 1);

  const title = "Browse LEGO sets";
  const description = "Browse LEGO sets by rating, year, pieces, and more.";
  const canonicalPath = "/sets";

  // SEO rule:
  // - /sets is indexable
  // - /sets?page=2+ should not be indexed (avoid duplicate/pagination bloat)
  const robots = page > 1 ? { index: false, follow: true } : undefined;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title, description },
    ...(robots ? { robots } : {}),
  };
}

export default async function Page({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  const sp = await unwrapSearchParams(searchParams);

  // No query term = browsing mode
  const q = "";

  // Keep compatibility with SearchClient’s dropdown values.
  // Your SearchClient options include:
  // relevance, rating_desc, rating_asc, pieces_desc, pieces_asc, year_desc, year_asc, name_asc, name_desc
  const sort = first(sp, "sort") || "rating_desc";
  const order = first(sp, "order") || ""; // SearchClient may ignore this depending on implementation

  const page = parsePositiveInt(first(sp, "page") || "1", 1);

  return <SearchClient initialQ={q} initialSort={sort} initialOrder={order} initialPage={page} />;
}