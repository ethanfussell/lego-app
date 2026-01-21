// frontend_next/app/search/SearchClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SetCard from "@/app/components/SetCard";
import Pagination from "@/app/components/Pagination";
import AddToListMenu from "@/app/components/AddToListMenu";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";

const RECENT_KEY = "recent_searches_v1";
const MAX_RECENTS = 5;
const PAGE_SIZE = 50;

const POPULAR_TERMS = ["Star Wars", "Botanical", "Icons", "Technic", "Modular", "Castle", "Space", "Harry Potter"];

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  num_parts?: number;
  image_url?: string | null;
  theme?: string;
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

function readRecents(): string[] {
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

function normalizeSetsResponse(data: SetsResponse): { results: SetLite[]; total: number | null; totalPages: number } {
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
  const { token } = useAuth();

  // URL is source of truth (lets back/forward work)
  const q = useMemo(() => (sp.get("q") || initialQ || "").trim(), [sp, initialQ]);
  const sort = useMemo(() => (sp.get("sort") || initialSort || "relevance").trim(), [sp, initialSort]);
  const page = useMemo(() => {
    const p = Number(sp.get("page") || initialPage || 1);
    return Number.isFinite(p) && p > 0 ? p : 1;
  }, [sp, initialPage]);

  // local input box state
  const [input, setInput] = useState(q);

  useEffect(() => {
    setInput(q);
  }, [q]);

  // recents
  const [recents, setRecents] = useState<string[]>(() => (typeof window === "undefined" ? [] : readRecents()));

  useEffect(() => {
    function onStorage() {
      setRecents(readRecents());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // results state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [results, setResults] = useState<SetLite[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);

  const lastReqKeyRef = useRef<string>("");

  async function runSearch(nextQ: string, nextSort = sort, nextPage = 1) {
    const cleanQ = String(nextQ || "").trim();
    if (!cleanQ) return;

    const params = new URLSearchParams();
    params.set("q", cleanQ);
    params.set("sort", nextSort || "relevance");
    params.set("page", String(nextPage));
    // if your backend supports it, keep it explicit:
    params.set("limit", String(PAGE_SIZE));

    router.push(`/search?${params.toString()}`);

    const nextRecents = pushRecent(cleanQ);
    setRecents(nextRecents);
    // same-tab listeners
    window.dispatchEvent(new Event("storage"));
  }

  // fetch whenever q/sort/page changes
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

      const reqKey = `${q}__${sort}__${page}`;
      lastReqKeyRef.current = reqKey;

      try {
        setLoading(true);
        setErr("");

        const params = new URLSearchParams();
        params.set("q", q);
        params.set("sort", sort || "relevance");
        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));

        const data = await apiFetch<SetsResponse>(`/sets?${params.toString()}`, { cache: "no-store" });

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
  }, [q, sort, page]);

  const heading = q ? `Search: "${q}"` : "Search";

  const showEmptyPrompt = !loading && !err && !q;
  const showNoResults = !loading && !err && !!q && results.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16">
      {/* Header + Search box */}
      <div className="pt-10">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">{heading}</h1>
        <div className="mt-2 text-sm text-zinc-500">
          {q && total != null ? `${total.toLocaleString()} result${total === 1 ? "" : "s"}` : null}
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await runSearch(input, sort, 1);
          }}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search sets (e.g. castle, space, technic)…"
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
              value={sort}
              onChange={async (e) => {
                const next = e.target.value;
                if (!q) return;
                await runSearch(q, next, 1);
              }}
              disabled={!q || loading}
              className="h-10 rounded-2xl border border-black/[.10] bg-white px-3 text-sm font-semibold dark:border-white/[.14] dark:bg-zinc-950"
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
      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* LEFT: Sticky sidebar */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
            <div className="text-sm font-extrabold">Popular right now</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {POPULAR_TERMS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => runSearch(t, sort, 1)}
                  className="rounded-full border border-black/[.10] bg-white px-3 py-1.5 text-xs font-extrabold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
                  title={`Search "${t}"`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-5">
              <div className="text-sm font-extrabold">Recent</div>

              {recents.length === 0 ? (
                <div className="mt-2 text-sm text-zinc-500">No recent searches yet.</div>
              ) : (
                <div className="mt-2 grid gap-2">
                  {recents.slice(0, MAX_RECENTS).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => runSearch(t, sort, 1)}
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

        {/* RIGHT: Results */}
        <main>
          {loading ? <p className="m-0 text-sm">Loading…</p> : null}
          {err && !loading ? <p className="m-0 text-sm text-red-600">Error: {err}</p> : null}

          {showEmptyPrompt ? (
            <div className="text-sm text-zinc-500">Type a search above or click a Popular chip to explore sets.</div>
          ) : null}

          {showNoResults ? <div className="text-sm text-zinc-500">No results found. Try a different search.</div> : null}

          <div className="mt-4 grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
            {results.map((set) => (
              <div key={set.set_num} className="w-[220px]">
                <SetCard
                  set={set}
                  footer={token ? <AddToListMenu token={token} setNum={set.set_num} /> : null}
                />
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
                onPageChange={(p: number) => runSearch(q, sort, p)}
              />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}