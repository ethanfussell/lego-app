// frontend_next/app/discover/DiscoverClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SetCard from "@/app/components/SetCard";
import Pagination from "@/app/components/Pagination";
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

// Keep these if you like them as quick links INTO /search
const POPULAR_TERMS = ["Star Wars", "Botanical", "Icons", "Technic", "Modular", "Castle", "Space", "Harry Potter"];

function normalizeSort(v: unknown) {
  // Feed default: newest-ish
  const s = String(v || "year");
  const allowed = new Set(["rating", "pieces", "year", "name"]);
  return allowed.has(s) ? s : "year";
}

function normalizeOrder(v: unknown) {
  const s = String(v || "desc");
  return s === "asc" ? "asc" : "desc";
}

function toNum(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function fetchFeed(opts: { sort: string; order: string; page: number; limit: number }) {
  const params = new URLSearchParams();
  params.set("sort", opts.sort);
  params.set("order", opts.order);
  params.set("page", String(opts.page));
  params.set("limit", String(opts.limit));

  // ✅ no q param — discover is a feed
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

export default function DiscoverClient({ initial }: { initial: DiscoverInitial }) {
  const router = useRouter();
  const sp = useSearchParams();

  // ✅ Discover ignores q completely
  const sort = normalizeSort(sp.get("sort") ?? initial.sort);
  const order = normalizeOrder(sp.get("order") ?? initial.order);
  const page = toNum(sp.get("page") ?? initial.page, 1);

  const pageSize = initial.pageSize || PAGE_SIZE_FALLBACK;

  const [results, setResults] = useState<SetLite[]>(initial.results || []);
  const [total, setTotal] = useState<number>(initial.total || 0);
  const [totalPages, setTotalPages] = useState<number>(initial.totalPages || 1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initial.error || null);

  function pushUrl(next: { sort?: string; order?: string; page?: number }) {
    const params = new URLSearchParams();

    const nextSort = normalizeSort(next.sort ?? sort);
    const nextOrder = normalizeOrder(next.order ?? order);
    const nextPage = toNum(next.page ?? page, 1);

    // Only set when not default-ish (optional, keeps URLs cleaner)
    if (nextSort && nextSort !== "year") params.set("sort", nextSort);
    if (nextOrder && nextOrder !== "desc") params.set("order", nextOrder);
    if (nextPage && nextPage !== 1) params.set("page", String(nextPage));

    const qs = params.toString();
    router.push(qs ? `/discover?${qs}` : `/discover`);
  }

  // Pull primitives out so the effect deps are stable
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

    // If SSR data already matches URL, don't re-fetch on first paint
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
      } catch (e: any) {
        if (ignore) return;

        setError(e?.message || String(e) || "Failed to load feed");
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
  }, [
    sort,
    order,
    page,
    pageSize,
    initialSort,
    initialOrder,
    initialPage,
    initialError,
  ]);

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
        <div className="mt-2 text-sm text-zinc-500">
          {total ? `${total.toLocaleString()} sets` : ""}
        </div>

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
        {/* LEFT sidebar: quick links INTO search */}
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

            <div className="mt-5 text-sm text-zinc-500">
              Looking for something specific? Use the search bar in the top nav.
            </div>
          </div>
        </aside>

        {/* RIGHT results */}
        <main>
          {loading ? <p className="mt-0 text-sm">Loading…</p> : null}
          {error && !loading ? <p className="mt-0 text-sm text-red-600">Error: {error}</p> : null}

          <div className="mt-2 grid grid-cols-[repeat(auto-fill,220px)] gap-4">
            {results.map((set) => (
              <div key={set.set_num}>
                {/* ✅ SetCard already has its own Link */}
                <SetCard set={set as any} />
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