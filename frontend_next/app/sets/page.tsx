// frontend_next/app/sets/page.tsx
import type { Metadata } from "next";
import SearchClient from "../search/SearchClient";

type SP = Record<string, string | string[] | undefined>;

const SITE_NAME = "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function isPromiseLike<T>(v: unknown): v is PromiseLike<T> {
  return (
    typeof v === "object" &&
    v !== null &&
    "then" in v &&
    typeof (v as { then?: unknown }).then === "function"
  );
}

async function unwrapSearchParams<T extends object>(p?: T | Promise<T>): Promise<T> {
  if (!p) return {} as T;
  return isPromiseLike<T>(p) ? await p : p;
}

function first(sp: SP, key: keyof SP): string {
  const raw = sp[key as string];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v ?? "").trim();
}

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