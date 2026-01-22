// frontend_next/app/discover/page.tsx
import DiscoverClient, { type DiscoverInitial } from "./DiscoverClient";
import { apiFetch } from "@/lib/api";

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

function toNum(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeSort(v: unknown) {
  // For "feed", default to newest-ish.
  // If your backend supports these, keep them. Otherwise we can adjust.
  const s = String(v || "year").trim();
  const allowed = new Set(["year", "rating", "pieces", "name", "relevance"]);
  return allowed.has(s) ? s : "year";
}

function normalizeOrder(v: unknown) {
  const s = String(v || "desc").trim();
  return s === "asc" ? "asc" : "desc";
}

async function fetchFeed(opts: { sort: string; order: string; page: number; limit: number }) {
  const params = new URLSearchParams();
  params.set("sort", opts.sort);
  params.set("order", opts.order);
  params.set("page", String(opts.page));
  params.set("limit", String(opts.limit));

  // ✅ No q param — discover is a feed, not search
  const data = await apiFetch<any>(`/sets?${params.toString()}`, { cache: "no-store" });

  const results: SetLite[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
    ? data.results
    : [];

  const total = typeof data?.total === "number" ? data.total : results.length;
  const totalPages =
    typeof data?.total_pages === "number"
      ? data.total_pages
      : Math.max(1, Math.ceil(total / opts.limit));

  const page = typeof data?.page === "number" ? data.page : opts.page;

  return { results, total, totalPages, page };
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // ✅ Ignore q entirely (even if someone manually adds it)
  const sortRaw = searchParams?.sort;
  const orderRaw = searchParams?.order;

  const sort = normalizeSort(Array.isArray(sortRaw) ? sortRaw[0] : sortRaw);
  const order = normalizeOrder(Array.isArray(orderRaw) ? orderRaw[0] : orderRaw);
  const page = toNum(searchParams?.page, 1);

  const pageSize = 50;

  let initial: DiscoverInitial = {
    q: "", // keep field if DiscoverClient expects it, but it's always empty here
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
    };
  } catch (e: any) {
    initial = { ...initial, error: e?.message || String(e) };
  }

  return <DiscoverClient initial={initial} />;
}