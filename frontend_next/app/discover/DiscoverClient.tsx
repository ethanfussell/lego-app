// frontend_next/app/discover/DiscoverClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  q: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
  results: SetLite[];
  total: number;
  totalPages: number;
  error: string | null;
};

const RECENT_KEY = "recent_searches_v1";
const MAX_RECENTS = 5;

const POPULAR_TERMS = ["Star Wars", "Botanical", "Icons", "Technic", "Modular", "Castle", "Space", "Harry Potter"];

function readRecents() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(String).map((s) => s.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeRecents(next: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function pushRecent(term: string) {
  const t = String(term || "").trim();
  if (!t) return readRecents();

  const prev = readRecents();
  const deduped = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())];
  const sliced = deduped.slice(0, MAX_RECENTS);
  writeRecents(sliced);
  return sliced;
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
function toNum(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function fetchSets(opts: { q: string; sort: string; order: string; page: number; limit: number }) {
  const params = new URLSearchParams();
  params.set("q", opts.q);
  params.set("sort", opts.sort);
  params.set("order", opts.order);
  params.set("page", String(opts.page));
  params.set("limit", String(opts.limit));

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

  // URL state (source of truth)
  const q = String(sp.get("q") || "").trim();
  const sort = normalizeSort(sp.get("sort"));
  const order = normalizeOrder(sp.get("order"));
  const page = toNum(sp.get("page"), 1);

  const pageSize = initial.pageSize || 50;

  // local input box
  const [input, setInput] = useState(initial.q || q);

  useEffect(() => {
    setInput(q);
  }, [q]);

  // recents
  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => {
    setRecents(readRecents());
    const onStorage = () => setRecents(readRecents());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // results state (seed from server)
  const [results, setResults] = useState<SetLite[]>(initial.results || []);
  const [total, setTotal] = useState<number>(initial.total || 0);
  const [totalPages, setTotalPages] = useState<number>(initial.totalPages || 1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initial.error || null);

  const heading = useMemo(() => (q ? `Search: "${q}"` : "Discover"), [q]);

  function pushUrl(next: { q?: string; sort?: string; order?: string; page?: number }) {
    const params = new URLSearchParams();
    const nextQ = String(next.q ?? q).trim();
    if (nextQ) params.set("q", nextQ);

    const nextSort = normalizeSort(next.sort ?? sort);
    const nextOrder = normalizeOrder(next.order ?? order);
    const nextPage = toNum(next.page ?? page, 1);

    if (nextQ) {
      if (nextSort && nextSort !== "relevance") params.set("sort", nextSort);
      if (nextOrder && nextOrder !== "desc") params.set("order", nextOrder);
      if (nextPage && nextPage !== 1) params.set("page", String(nextPage));
    }

    const qs = params.toString();
    router.push(qs ? `/discover?${qs}` : `/discover`);
  }

  async function run(term: string, nextSort = sort, nextOrder = order, nextPage = 1) {
    const termTrim = String(term || "").trim();
    if (!termTrim) return;

    // update URL first (so sharing/back works)
    pushUrl({ q: termTrim, sort: nextSort, order: nextOrder, page: nextPage });

    // recents
    const nextRecents = pushRecent(termTrim);
    setRecents(nextRecents);
    window.dispatchEvent(new Event("storage"));
  }

  // Fetch whenever URL changes (q/sort/order/page)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);

      if (!q) {
        setResults([]);
        setTotal(0);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const r = await fetchSets({ q, sort, order, page, limit: pageSize });
        if (cancelled) return;
        setResults(r.results);
        setTotal(r.total);
        setTotalPages(r.totalPages);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || String(e));
        setResults([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Avoid “double fetch on first paint” when URL matches server-provided initial
    const matchesInitial =
      q === initial.q &&
      sort === initial.sort &&
      order === initial.order &&
      page === initial.page &&
      !initial.error;

    if (!matchesInitial) load();

    return () => {
      cancelled = true;
    };
  }, [q, sort, order, page, pageSize, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await run(input, sort, order, 1);
  }

  async function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = normalizeSort(e.target.value);
    if (!q) return;
    await run(q, next, order, 1);
  }

  async function goToPage(p: number) {
    if (!q) return;
    pushUrl({ q, sort, order, page: p });
  }

  const showEmptyPrompt = !loading && !error && !q;
  const showNoResults = !loading && !error && !!q && results.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">{heading}</h1>
        <div className="mt-2 text-sm text-zinc-500">
          {q && total != null ? `${total.toLocaleString()} result${total === 1 ? "" : "s"}` : ""}
        </div>

        {/* On-page search box */}
        <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search sets (e.g. castle, space, technic)…"
            className="flex-1 rounded-xl border border-black/[.10] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[.14] dark:bg-zinc-950 dark:focus:ring-white/10"
          />
          <button
            type="submit"
            className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white hover:opacity-90 dark:bg-white dark:text-black"
          >
            Search
          </button>
        </form>

        {/* Sort under search, right-aligned */}
        <div className="mt-3 flex justify-end">
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="text-zinc-500">Sort</span>
            <select
              value={sort}
              onChange={handleSortChange}
              disabled={!q || loading}
              className="rounded-lg border border-black/[.10] bg-white px-3 py-2 text-sm outline-none dark:border-white/[.14] dark:bg-zinc-950"
            >
              <option value="relevance">Relevance</option>
              <option value="rating">Rating</option>
              <option value="pieces">Pieces</option>
              <option value="year">Year</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
        {/* LEFT sidebar */}
        <aside className="sticky top-24 h-fit">
          <div className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.14] dark:bg-zinc-950">
            <div className="mb-3 font-semibold">Popular right now</div>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TERMS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => run(t, sort, order, 1)}
                  className="rounded-full border border-black/[.10] bg-white px-3 py-1 text-xs font-semibold hover:bg-black/[.04] dark:border-white/[.14] dark:bg-transparent dark:hover:bg-white/[.06]"
                  title={`Search "${t}"`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-5">
              <div className="mb-2 font-semibold">Recent</div>
              {recents.length === 0 ? (
                <div className="text-sm text-zinc-500">No recent searches yet.</div>
              ) : (
                <div className="grid gap-2">
                  {recents.slice(0, MAX_RECENTS).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => run(t, sort, order, 1)}
                      className="rounded-xl border border-black/[.06] bg-zinc-50 px-3 py-2 text-left text-sm font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-white/[.10] dark:bg-white/5 dark:text-zinc-50 dark:hover:bg-white/10"
                      title={`Search "${t}"`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT results */}
        <main>
          {loading ? <p className="mt-0 text-sm">Loading…</p> : null}
          {error && !loading ? <p className="mt-0 text-sm text-red-600">Error: {error}</p> : null}

          {showEmptyPrompt ? (
            <div className="mt-2 text-sm text-zinc-500">Type a search above or click a Popular chip to explore sets.</div>
          ) : null}

          {showNoResults ? (
            <div className="mt-2 text-sm text-zinc-500">No results found. Try a different search.</div>
          ) : null}

          <div className="mt-4 grid grid-cols-[repeat(auto-fill,220px)] gap-4">
            {results.map((set) => (
              <div
                key={set.set_num}
                className="cursor-pointer"
                onClick={() => router.push(`/sets/${encodeURIComponent(set.set_num)}`)}
              >
                <SetCard set={set as any} />
              </div>
            ))}
          </div>

          {q && totalPages > 1 ? (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total || 0}
              pageSize={pageSize}
              disabled={loading}
              onPageChange={goToPage}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}