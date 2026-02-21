// frontend_next/app/discover/page.tsx

import type { Metadata } from "next";
import DiscoverClient, { type DiscoverInitial } from "./DiscoverClient";

export const revalidate = 3600; // ISR (1 hour)

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Discover | LEGO App",
    description: "Browse a feed of LEGO sets sorted by rating, year, pieces, and more.",
    alternates: { canonical: "/discover" },
  };
}

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string;
  image_url?: string | null;
  average_rating?: number | null;
  rating_avg?: number | null;
  rating_count?: number;
};

type FeedResponse =
  | SetLite[]
  | {
      results?: SetLite[];
      total?: number;
      total_pages?: number;
      page?: number;
    };

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

type SortKey = "year" | "rating" | "pieces" | "name" | "relevance";
type Order = "asc" | "desc";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function toPosInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeSort(v: unknown): SortKey {
  const s = String(v ?? "year").trim();
  const allowed: SortKey[] = ["year", "rating", "pieces", "name", "relevance"];
  return allowed.includes(s as SortKey) ? (s as SortKey) : "year";
}

function normalizeOrder(v: unknown): Order {
  return String(v ?? "desc").trim() === "asc" ? "asc" : "desc";
}

function isSetLite(x: unknown): x is SetLite {
  if (typeof x !== "object" || x === null) return false;
  const sn = (x as { set_num?: unknown }).set_num;
  return typeof sn === "string" && sn.trim().length > 0;
}

function toSetLiteArray(x: unknown): SetLite[] {
  if (!Array.isArray(x)) return [];
  return x.filter(isSetLite);
}

function asFeedResponse(x: unknown): FeedResponse {
  if (Array.isArray(x)) return toSetLiteArray(x);

  if (typeof x === "object" && x !== null) {
    const o = x as { results?: unknown; total?: unknown; total_pages?: unknown; page?: unknown };
    return {
      results: Array.isArray(o.results) ? toSetLiteArray(o.results) : undefined,
      total: typeof o.total === "number" ? o.total : undefined,
      total_pages: typeof o.total_pages === "number" ? o.total_pages : undefined,
      page: typeof o.page === "number" ? o.page : undefined,
    };
  }

  return [];
}

async function fetchFeed(opts: { sort: SortKey; order: Order; page: number; limit: number }) {
  const params = new URLSearchParams();
  params.set("sort", opts.sort);
  params.set("order", opts.order);
  params.set("page", String(opts.page));
  params.set("limit", String(opts.limit));

  const url = `${apiBase()}/sets?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    next: { revalidate }, // ✅ THIS is what makes the route cacheable
  });

  if (!res.ok) {
    return { results: [] as SetLite[], total: 0, totalPages: 1, page: opts.page, error: `${res.status} ${res.statusText}` };
  }

  const raw: unknown = await res.json().catch(() => null);
  const data = asFeedResponse(raw);

  const results: SetLite[] = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : [];

  const total =
    !Array.isArray(data) && typeof data.total === "number"
      ? data.total
      : results.length;

  const totalPages =
    !Array.isArray(data) && typeof data.total_pages === "number"
      ? data.total_pages
      : Math.max(1, Math.ceil(Math.max(1, total) / Math.max(1, opts.limit)));

  const page =
    !Array.isArray(data) && typeof data.page === "number"
      ? data.page
      : opts.page;

  return { results, total, totalPages, page, error: null as string | null };
}

export default async function Page({ searchParams }: PageProps) {
  const sp: SearchParams = await Promise.resolve(searchParams ?? {});

  const sort: SortKey = normalizeSort(first(sp, "sort"));
  const order: Order = normalizeOrder(first(sp, "order"));
  const page = toPosInt(first(sp, "page"), 1);

  const pageSize = 50;

  let initial: DiscoverInitial = {
    q: "",
    sort,
    order,
    page,
    pageSize,
    results: [],
    total: 0,
    totalPages: 1,
    error: null,
  };

  try {
    const r = await fetchFeed({ sort, order, page, limit: pageSize });
    initial = {
      ...initial,
      results: r.results,
      total: r.total,
      totalPages: r.totalPages,
      page: r.page,
      error: r.error,
    };
  } catch (e: unknown) {
    initial = { ...initial, error: errorMessage(e) };
  }

  return <DiscoverClient initial={initial} />;
}