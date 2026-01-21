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
  const s = String(v || "relevance");
  const allowed = new Set(["relevance", "rating", "pieces", "year", "name"]);
  return allowed.has(s) ? s : "relevance";
}

function normalizeOrder(v: unknown) {
  const s = String(v || "desc");
  return s === "asc" ? "asc" : "desc";
}

async function fetchSets(opts: { q: string; sort: string; order: string; page: number; limit: number }) {
  const params = new URLSearchParams();
  params.set("q", opts.q);
  params.set("sort", opts.sort);
  params.set("order", opts.order);
  params.set("page", String(opts.page));
  params.set("limit", String(opts.limit));

  // Your backend already supports /sets?...
  const data = await apiFetch<any>(`/sets?${params.toString()}`, { cache: "no-store" });

  // Accept either shape:
  // 1) array
  // 2) { results, total, page, total_pages }
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
  const q = String(searchParams?.q ?? "").trim();
  const sort = normalizeSort(searchParams?.sort);
  const order = normalizeOrder(searchParams?.order);
  const page = toNum(searchParams?.page, 1);

  const pageSize = 50;

  let initial: DiscoverInitial = {
    q,
    sort,
    order,
    page,
    pageSize,
    results: [],
    total: 0,
    totalPages: 1,
    error: null,
  };

  if (q) {
    try {
      const r = await fetchSets({ q, sort, order, page, limit: pageSize });
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
  }

  return <DiscoverClient initial={initial} />;
}