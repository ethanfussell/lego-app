// frontend_next/app/search/SearchClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SetCard from "@/app/components/SetCard";
import Pagination from "@/app/components/Pagination";
import { apiFetch } from "@/lib/api";

const RECENT_KEY = "recent_searches_v1";
const MAX_RECENTS = 5;
const PAGE_SIZE = 50;

const POPULAR_TERMS = [
  "Star Wars",
  "Botanical",
  "Icons",
  "Technic",
  "Modular",
  "Castle",
  "Space",
  "Harry Potter",
];

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  num_parts?: number;
  pieces?: number;
  image_url?: string | null;
  theme?: string;

  // optional if your API supports it
  rating_avg?: number | null;
  average_rating?: number | null;
  rating_count?: number | null;
};

type SetsResponse =
  | SetLite[]
  | {
      results?: SetLite[];
      total?: number;
      total_results?: number;
      count?: number;
      page?: number;
      total_pages?: number;
      pages?: number;
    };

function readRecentsSafe(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(String).map((s) => s.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeRecentsSafe(next: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function pushRecentSafe(term: string) {
  const t = String(term || "").trim();
  if (!t) return readRecentsSafe();

  const prev = readRecentsSafe();
  const deduped = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())];
  const sliced = deduped.slice(0, MAX_RECENTS);
  writeRecentsSafe(sliced);
  return sliced;
}

function normalizeSetsResponse(
  data: SetsResponse
): { results: SetLite[]; total: number | null; totalPages: number } {
  if (Array.isArray(data)) {
    return { results: data, total: null, totalPages: 1 };
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  const total =
    typeof data?.total === "number"
      ? data.total
      : typeof data?.total_results === "number"
      ? data.total_results
      : typeof data?.count === "number"
      ? data.count
      : null;

  const totalPages =
    typeof data?.total_pages === "number"
      ? data.total_pages
      : typeof data?.pages === "number"
      ? data.pages
      : total != null
      ? Math.max(1, Math.ceil(total / PAGE_SIZE))
      : 1;

  return { results, total, totalPages };
}

/** sort + order packed into one select value */
type SortValue =
  | "relevance"
  | "rating_desc"
  | "rating_asc"
  | "pieces_desc"
  | "pieces_asc"
  | "year_desc"
  | "year_asc"
  | "name_asc"
  | "name_desc";

function parseSortValue(v: string): { sort: string; order?: "asc" | "desc" } {
  const raw = (v || "relevance").trim();

  if (raw === "relevance") return { sort: "relevance" };

  const [sort, order] = raw.split("_");
  if (!sort) return { sort: "relevance" };
  if (order === "asc" || order === "desc") return { sort, order };

  return { sort: raw };
}

function toSortValue(sort: string, order?: string): SortValue {
  const s = (sort || "relevance").trim();
  const o = (order || "").trim();
  const key = o ? `${s}_${o}` : s;

  const allowed: SortValue[] = [
    "relevance",
    "rating_desc",
    "rating_asc",
    "pieces_desc",
    "pieces_asc",
    "year_desc",
    "year_asc",
    "name_asc",
    "name_desc",
  ];

  return (allowed.includes(key as SortValue) ? key : "relevance") as SortValue;
}

export default function SearchClient({
  initialQ,
  initialSort,
  initialPage,
}: {
  initialQ: string;
  initialSort: string;
  initialPage: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const q = useMemo(() => (sp.get("q") || initialQ || "").trim(), [sp, initialQ]);

  // URL params: sort + order
  const sortParam = useMemo(() => (sp.get("sort") || initialSort || "relevance").trim(), [sp, initialSort]);
  const orderParam = useMemo(() => (sp.get("order") || "").trim(), [sp]);

  // value used by the select
  const sortValue = useMemo(() => toSortValue(sortParam, orderParam), [sortParam, orderParam]);

  const page = useMemo(() => {
    const p = Number(sp.get("page") || initialPage || 1);
    return Number.isFinite(p) && p > 0 ? p : 1;
  }, [sp, initialPage]);

  const [input, setInput] = useState(q);
  useEffect(() => setInput(q), [q]);

  const [recents, setRecents] = useState<string[] | null>(null);

  useEffect(() => {
    setRecents(readRecentsSafe());
  }, []);

  useEffect(() => {
    function onStorage() {
      setRecents(readRecentsSafe());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [results, setResults] = useState<SetLite[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);

  const lastReqKeyRef = useRef<string>("");

  async function runSearch(nextQ: string, nextSortValue: SortValue = sortValue, nextPage = 1) {
    const cleanQ = String(nextQ || "").trim();
    if (!cleanQ) return;

    const { sort, order } = parseSortValue(nextSortValue);

    const params = new URLSearchParams();
    params.set("q", cleanQ);
    params.set("sort", sort || "relevance");
    if (order) params.set("order", order);
    else params.delete("order");
    params.set("page", String(nextPage));
    params.set("limit", String(PAGE_SIZE));

    router.push(`/search?${params.toString()}`);

    const nextRecents = pushRecentSafe(cleanQ);
    setRecents(nextRecents);
    window.dispatchEvent(new Event("storage"));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!q) {
        setResults([]);
        setTotal(null);
        setTotalPages(1);
        setErr("");
        return;
      }

      const reqKey = `${q}__${sortParam}__${orderParam}__${page}`;
      lastReqKeyRef.current = reqKey;

      try {
        setLoading(true);
        setErr("");

        const params = new URLSearchParams();
        params.set("q", q);

        // send sort + order to API
        params.set("sort", sortParam || "relevance");
        if (orderParam) params.set("order", orderParam);

        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));

        const data = await apiFetch<SetsResponse>(`/sets?${params.toString()}`, {
          cache: "no-store",
        });

        if (cancelled) return;
        if (lastReqKeyRef.current !== reqKey) return;

        const norm = normalizeSetsResponse(data as any);
        setResults(norm.results);
        setTotal(norm.total);
        setTotalPages(norm.totalPages);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e) || "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [q, sortParam, orderParam, page]);

  const heading = q ? `Search: "${q}"` : "Search";
  const showEmptyPrompt = !loading && !err && !q;
  const showNoResults = !loading && !err && !!q && results.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="pt-10">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">{heading}</h1>
        <div className="mt-2 text-sm text-zinc-500">
          {q && total != null ? `${total.toLocaleString()} result${total === 1 ? "" : "s"}` : null}
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await runSearch(input, sortValue, 1);
          }}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Search sets (e.g. castle, space, technic)…'
            className="h-12 w-full flex-1 rounded-2xl border border-black/[.10] bg-white px-4 text-sm outline-none dark:border-white/[.14] dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="h-12 rounded-2xl bg-black px-5 text-sm font-extrabold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Search
          </button>
        </form>

        {/* Sort (right-aligned) */}
        <div className="mt-3 flex justify-end">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Sort</span>
            <select
              value={sortValue}
              onChange={async (e) => {
                if (!q) return;
                await runSearch(q, e.target.value as SortValue, 1);
              }}
              disabled={!q || loading}
              className="h-10 rounded-2xl border border-black/[.10] bg-white px-3 text-sm font-semibold dark:border-white/[.14] dark:bg-zinc-950"
            >
              <option value="relevance">Relevance</option>

              <option value="rating_desc">Rating (high → low)</option>
              <option value="rating_asc">Rating (low → high)</option>

              <option value="pieces_desc">Pieces (high → low)</option>
              <option value="pieces_asc">Pieces (low → high)</option>

              <option value="year_desc">Year (new → old)</option>
              <option value="year_asc">Year (old → new)</option>

              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
            <div className="text-sm font-extrabold">Popular right now</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {POPULAR_TERMS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => runSearch(t, sortValue, 1)}
                  className="rounded-full border border-black/[.10] bg-white px-3 py-1.5 text-xs font-extrabold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
                  title={`Search "${t}"`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-5">
              <div className="text-sm font-extrabold">Recent</div>

              {recents === null ? (
                <div className="mt-2 text-sm text-zinc-500">Loading…</div>
              ) : recents.length === 0 ? (
                <div className="mt-2 text-sm text-zinc-500">No recent searches yet.</div>
              ) : (
                <div className="mt-2 grid gap-2">
                  {recents.slice(0, MAX_RECENTS).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => runSearch(t, sortValue, 1)}
                      className="w-full rounded-2xl border border-black/[.06] bg-zinc-50 px-3 py-2 text-left text-sm font-extrabold text-zinc-900 hover:bg-zinc-100 dark:border-white/[.10] dark:bg-black dark:text-zinc-50 dark:hover:bg-white/[.06]"
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

        <main>
          {loading ? <p className="m-0 text-sm">Loading…</p> : null}
          {err && !loading ? <p className="m-0 text-sm text-red-600">Error: {err}</p> : null}

          {showEmptyPrompt ? (
            <div className="text-sm text-zinc-500">Type a search above or click a Popular chip to explore sets.</div>
          ) : null}

          {showNoResults ? (
            <div className="text-sm text-zinc-500">No results found. Try a different search.</div>
          ) : null}

          {/* ✅ 3 per row on desktop, no footer actions */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((set) => (
              <div key={set.set_num} className="h-full">
                <SetCard set={set as any} />
              </div>
            ))}
          </div>

          {q && totalPages > 1 ? (
            <div className="mt-6">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total || 0}
                pageSize={PAGE_SIZE}
                disabled={loading}
                onPageChange={(p: number) => runSearch(q, sortValue, p)}
              />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}