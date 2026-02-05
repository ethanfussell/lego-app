// frontend_next/app/discover/DiscoverClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SetCard, { type SetLite } from "@/app/components/SetCard";
import Pagination from "@/app/components/Pagination";
import { apiFetch } from "@/lib/api";

export type DiscoverInitial = {
  q: string; // kept for compatibility, but Discover ignores it
  sort: string;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
  results: SetLite[];
  total: number;
  totalPages: number;
  error: string | null;
};

const PAGE_SIZE_FALLBACK = 50;

const POPULAR_TERMS = ["Star Wars", "Botanical", "Icons", "Technic", "Modular", "Castle", "Space", "Harry Potter"];

type FeedResponse =
  | SetLite[]
  | {
      results?: unknown;
      total?: unknown;
      total_pages?: unknown;
      page?: unknown;
    };

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function normalizeSort(v: unknown) {
  const s = String(v ?? "year").trim();
  const allowed = new Set(["rating", "pieces", "year", "name"]);
  return allowed.has(s) ? s : "year";
}

function normalizeOrder(v: unknown): "asc" | "desc" {
  const s = String(v ?? "desc").trim();
  return s === "asc" ? "asc" : "desc";
}

function toNum(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isSetLite(x: unknown): x is SetLite {
  return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
}

function toSetLiteArray(x: unknown): SetLite[] {
  if (!Array.isArray(x)) return [];
  return x.filter(isSetLite);
}

async function fetchFeed(opts: { sort: string; order: "asc" | "desc"; page: number; limit: number }) {
  const params = new URLSearchParams();
  params.set("sort", opts.sort);
  params.set("order", opts.order);
  params.set("page", String(opts.page));
  params.set("limit", String(opts.limit));

  const raw = await apiFetch<unknown>(`/sets?${params.toString()}`, { cache: "no-store" });
  const data = raw as FeedResponse;

  const results: SetLite[] = Array.isArray(data)
    ? toSetLiteArray(data)
    : Array.isArray(data?.results)
      ? toSetLiteArray(data.results)
      : [];

  const total = !Array.isArray(data) && typeof data?.total === "number" ? data.total : results.length;

  const totalPages =
    !Array.isArray(data) && typeof data?.total_pages === "number"
      ? data.total_pages
      : Math.max(1, Math.ceil(total / Math.max(1, opts.limit)));

  const page = !Array.isArray(data) && typeof data?.page === "number" ? data.page : opts.page;

  return { results, total, totalPages, page };
}

export default function DiscoverClient({ initial }: { initial: DiscoverInitial }) {
  const router = useRouter();
  const sp = useSearchParams();

  const sort = normalizeSort(sp.get("sort") ?? initial.sort);
  const order = normalizeOrder(sp.get("order") ?? initial.order);
  const page = toNum(sp.get("page") ?? initial.page, 1);
  const pageSize = initial.pageSize || PAGE_SIZE_FALLBACK;

  const [results, setResults] = useState<SetLite[]>(initial.results || []);
  const [total, setTotal] = useState<number>(initial.total || 0);
  const [totalPages, setTotalPages] = useState<number>(initial.totalPages || 1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initial.error || null);

  function pushUrl(next: { sort?: string; order?: "asc" | "desc"; page?: number }) {
    const params = new URLSearchParams();

    const nextSort = normalizeSort(next.sort ?? sort);
    const nextOrder = normalizeOrder(next.order ?? order);
    const nextPage = toNum(next.page ?? page, 1);

    if (nextSort && nextSort !== "year") params.set("sort", nextSort);
    if (nextOrder && nextOrder !== "desc") params.set("order", nextOrder);
    if (nextPage && nextPage !== 1) params.set("page", String(nextPage));

    const qs = params.toString();
    router.push(qs ? `/discover?${qs}` : "/discover");
  }

  const initialSort = initial.sort;
  const initialOrder = initial.order;
  const initialPage = initial.page;
  const initialError = initial.error;

  useEffect(() => {
    let ignore = false;

    const matchesInitial =
      sort === normalizeSort(initialSort) &&
      order === normalizeOrder(initialOrder) &&
      page === toNum(initialPage, 1) &&
      !initialError;

    if (matchesInitial) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const r = await fetchFeed({ sort, order, page, limit: pageSize });
        if (ignore) return;

        setResults(r.results);
        setTotal(r.total);
        setTotalPages(r.totalPages);
      } catch (e: unknown) {
        if (ignore) return;

        setError(errorMessage(e) || "Failed to load feed");
        setResults([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [sort, order, page, pageSize, initialSort, initialOrder, initialPage, initialError]);

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    pushUrl({ sort: e.target.value, page: 1 });
  }

  function goToPage(p: number) {
    pushUrl({ page: p });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">Discover</h1>
        <div className="mt-2 text-sm text-zinc-500">{total ? `${total.toLocaleString()} sets` : ""}</div>

        <div className="mt-3 flex justify-end">
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="text-zinc-500">Sort</span>
            <select
              value={sort}
              onChange={handleSortChange}
              disabled={loading}
              className="rounded-lg border border-black/[.10] bg-white px-3 py-2 text-sm outline-none dark:border-white/[.14] dark:bg-zinc-950"
            >
              <option value="year">Year</option>
              <option value="rating">Rating</option>
              <option value="pieces">Pieces</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
        <aside className="sticky top-24 h-fit">
          <div className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.14] dark:bg-zinc-950">
            <div className="mb-3 font-semibold">Popular searches</div>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TERMS.map((t) => (
                <Link
                  key={t}
                  href={`/search?q=${encodeURIComponent(t)}`}
                  className="rounded-full border border-black/[.10] bg-white px-3 py-1 text-xs font-semibold hover:bg-black/[.04] dark:border-white/[.14] dark:bg-transparent dark:hover:bg-white/[.06]"
                  title={`Search "${t}"`}
                >
                  {t}
                </Link>
              ))}
            </div>

            <div className="mt-5 text-sm text-zinc-500">Looking for something specific? Use the search bar in the top nav.</div>
          </div>
        </aside>

        <main>
          {loading ? <p className="mt-0 text-sm">Loading…</p> : null}
          {error && !loading ? <p className="mt-0 text-sm text-red-600">Error: {error}</p> : null}

          <div className="mt-2 grid grid-cols-[repeat(auto-fill,220px)] gap-4">
            {results.map((set) => (
              <div key={set.set_num}>
                <SetCard set={set} />
              </div>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-6">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total || 0}
                pageSize={pageSize}
                disabled={loading}
                onPageChange={goToPage}
              />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}