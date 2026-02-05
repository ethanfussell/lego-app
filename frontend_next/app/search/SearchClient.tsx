// frontend_next/app/search/SearchClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SetCard from "@/app/components/SetCard";
import Pagination from "@/app/components/Pagination";
import { apiFetch } from "@/lib/api";

const RECENT_KEY = "recent_searches_v1";
const MAX_RECENTS = 5;
const PAGE_SIZE = 50;

const POPULAR_TERMS = ["Star Wars", "Botanical", "Icons", "Technic", "Modular", "Castle", "Space", "Harry Potter"];

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  num_parts?: number;
  pieces?: number;
  image_url?: string | null;
  theme?: string;
  rating_avg?: number | null;
  average_rating?: number | null;
  rating_count?: number | null;
};

type SetsResponse =
  | SetLite[]
  | {
      results?: unknown;
      total?: unknown;
      total_results?: unknown;
      count?: unknown;
      page?: unknown;
      total_pages?: unknown;
      pages?: unknown;
    };

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function readRecentsSafe(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr: unknown = JSON.parse(raw || "[]");
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

function isSetLite(x: unknown): x is SetLite {
  return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
}

function toSetLiteArray(x: unknown): SetLite[] {
  return Array.isArray(x) ? x.filter(isSetLite) : [];
}

function normalizeSetsResponse(data: SetsResponse): { results: SetLite[]; total: number | null; totalPages: number } {
  if (Array.isArray(data)) return { results: toSetLiteArray(data), total: null, totalPages: 1 };

  const results = Array.isArray(data.results) ? toSetLiteArray(data.results) : [];

  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.total_results === "number"
        ? data.total_results
        : typeof data.count === "number"
          ? data.count
          : null;

  const totalPages =
    typeof data.total_pages === "number"
      ? data.total_pages
      : typeof data.pages === "number"
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

const ALLOWED_SORTS = new Set(["relevance", "name", "year", "pieces", "rating"] as const);
type SortKey = (typeof ALLOWED_SORTS extends Set<infer T> ? T : never) & string;

function defaultOrderForSort(sort: string): "asc" | "desc" {
  return sort === "rating" || sort === "relevance" ? "desc" : "asc";
}

function sanitizeSort(raw: string | null | undefined): SortKey {
  const s = String(raw || "relevance").trim() || "relevance";
  return (ALLOWED_SORTS.has(s as SortKey) ? s : "relevance") as SortKey;
}

function sanitizeOrder(raw: string | null | undefined): "asc" | "desc" | "" {
  const o = String(raw || "").trim();
  if (o === "asc" || o === "desc") return o;
  return "";
}

function parseSortValue(v: string): { sort: SortKey; order?: "asc" | "desc" } {
  const raw = (v || "relevance").trim();
  if (raw === "relevance") return { sort: "relevance" };

  const [sort, order] = raw.split("_");
  const s = sanitizeSort(sort);

  if (order === "asc" || order === "desc") return { sort: s, order };
  return { sort: s };
}

function toSortValue(sort: string, order?: string): SortValue {
  const s = sanitizeSort(sort);
  if (s === "relevance") return "relevance";

  const o = (order || "").trim() || defaultOrderForSort(s);
  const key = `${s}_${o}`;

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

  return allowed.includes(key as SortValue) ? (key as SortValue) : "relevance";
}

function buildCleanSearchUrl(params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export default function SearchClient({
  initialQ,
  initialSort,
  initialOrder,
  initialPage,
}: {
  initialQ: string;
  initialSort: string;
  initialOrder?: string;
  initialPage: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  // Avoid `as any` for SetCard props
  type SetCardSetProp = React.ComponentProps<typeof SetCard>["set"];

  // --- URL-derived values ---
  const rawQ = useMemo(() => (sp.get("q") ?? initialQ ?? "").trim(), [sp, initialQ]);
  const rawSort = useMemo(() => (sp.get("sort") ?? initialSort ?? "relevance").trim(), [sp, initialSort]);
  const rawOrder = useMemo(() => (sp.get("order") ?? initialOrder ?? "").trim(), [sp, initialOrder]);

  const rawPage = useMemo(() => {
    const v = sp.get("page");
    const p = Number(v ?? initialPage ?? 1);
    return Number.isFinite(p) ? p : 1;
  }, [sp, initialPage]);

  // --- Sanitized state used for API + UI ---
  const q = rawQ;
  const sortParam = useMemo(() => sanitizeSort(rawSort), [rawSort]);
  const orderParam = useMemo(() => sanitizeOrder(rawOrder), [rawOrder]);

  const page = useMemo(() => {
    const p = Math.floor(rawPage);
    return Number.isFinite(p) && p > 0 ? p : 1;
  }, [rawPage]);

  const sortValue = useMemo(() => toSortValue(sortParam, orderParam), [sortParam, orderParam]);

  // --- URL writer (keeps it clean) ---
  const pushUrl = useCallback(
    (next: { q?: string; sort?: string; order?: string; page?: number }, opts?: { replace?: boolean }) => {
      const params = new URLSearchParams(sp?.toString?.() || "");

      // q
      if (typeof next.q === "string") {
        const cleanQ = next.q.trim();
        if (cleanQ) params.set("q", cleanQ);
        else params.delete("q");
      }

      // sort
      if (typeof next.sort === "string") {
        const s = sanitizeSort(next.sort);
        if (s === "relevance") params.delete("sort");
        else params.set("sort", s);
      }

      // order
      if (typeof next.order === "string") {
        const o = sanitizeOrder(next.order);
        if (!o) params.delete("order");
        else params.set("order", o);
      }

      // page
      if (typeof next.page === "number") {
        const p = Number.isFinite(next.page) ? Math.floor(next.page) : 1;
        if (p <= 1) params.delete("page");
        else params.set("page", String(p));
      }

      // If q missing -> keep /search clean
      if (!(params.get("q") || "").trim()) {
        params.delete("sort");
        params.delete("order");
        params.delete("page");
      } else {
        // If sort is relevance -> drop order (clean)
        const s = sanitizeSort(params.get("sort"));
        if (s === "relevance") params.delete("order");

        // Drop order if it matches backend default (clean)
        const s2 = sanitizeSort(params.get("sort"));
        const o2 = sanitizeOrder(params.get("order"));
        const def = defaultOrderForSort(s2);
        if (s2 !== "relevance" && o2 && o2 === def) params.delete("order");
      }

      const url = buildCleanSearchUrl(params);
      const nav = opts?.replace ? router.replace : router.push;
      nav(url, { scroll: false });
    },
    [router, sp]
  );

  // --- Normalize URL on load / param changes ---
  const lastNormalizedRef = useRef<string>("");

  useEffect(() => {
    const cur = new URLSearchParams(sp?.toString?.() || "");

    const q0 = (cur.get("q") || "").trim();
    const sort0 = sanitizeSort(cur.get("sort"));
    const order0 = sanitizeOrder(cur.get("order"));
    const page0 = (() => {
      const n = Number(cur.get("page") || "1");
      const p = Number.isFinite(n) ? Math.floor(n) : 1;
      return p > 1 ? p : 1;
    })();

    const next = new URLSearchParams();

    if (q0) {
      next.set("q", q0);

      if (sort0 !== "relevance") next.set("sort", sort0);

      const def = defaultOrderForSort(sort0);
      const useOrder = sort0 === "relevance" ? "" : (order0 || def);
      if (sort0 !== "relevance" && useOrder && useOrder !== def) next.set("order", useOrder);

      if (page0 > 1) next.set("page", String(page0));
    }

    const normalizedUrl = buildCleanSearchUrl(next);
    const currentUrl = buildCleanSearchUrl(cur);

    if (normalizedUrl !== currentUrl && normalizedUrl !== lastNormalizedRef.current) {
      lastNormalizedRef.current = normalizedUrl;
      router.replace(normalizedUrl, { scroll: false });
    }
  }, [sp, router]);

  // --- Input mirrors q ---
  const [input, setInput] = useState(q);
  useEffect(() => setInput(q), [q]);

  // --- Recents ---
  const [recents, setRecents] = useState<string[] | null>(null);
  useEffect(() => setRecents(readRecentsSafe()), []);
  useEffect(() => {
    function onStorage() {
      setRecents(readRecentsSafe());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // --- Results state ---
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [results, setResults] = useState<SetLite[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);

  const lastReqKeyRef = useRef<string>("");

  // --- Public actions (URL only) ---
  const submitSearch = useCallback(
    (term: string) => {
      const clean = String(term || "").trim();
      if (!clean) {
        pushUrl({ q: "" });
        return;
      }

      pushUrl({ q: clean, page: 1 });

      const nextRecents = pushRecentSafe(clean);
      setRecents(nextRecents);
      window.dispatchEvent(new Event("storage"));
    },
    [pushUrl]
  );

  const changeSort = useCallback(
    (nextSortValue: SortValue) => {
      if (!q) return;
      const { sort, order } = parseSortValue(nextSortValue);
      pushUrl({ sort, order: order || "", page: 1 });
    },
    [q, pushUrl]
  );

  const changePage = useCallback(
    (nextPage: number) => {
      if (!q) return;
      pushUrl({ page: nextPage });
    },
    [q, pushUrl]
  );

  // --- Fetch whenever URL-derived state changes ---
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
        params.set("sort", sortParam || "relevance");

        if (sortParam !== "relevance") {
          const o = orderParam || defaultOrderForSort(sortParam);
          params.set("order", o);
        }

        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE)); // API-only, never in URL

        const data = await apiFetch<unknown>(`/sets?${params.toString()}`, { cache: "no-store" });

        if (cancelled) return;
        if (lastReqKeyRef.current !== reqKey) return;

        const norm = normalizeSetsResponse(data as SetsResponse);
        setResults(norm.results);
        setTotal(norm.total);
        setTotalPages(norm.totalPages);

        if (page > norm.totalPages && norm.totalPages >= 1) {
          pushUrl({ page: norm.totalPages }, { replace: true });
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(errorMessage(e) || "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [q, sortParam, orderParam, page, pushUrl]);

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
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch(input);
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

        <div className="mt-3 flex justify-end">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Sort</span>
            <select
              value={sortValue}
              onChange={(e) => changeSort(e.target.value as SortValue)}
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
                  onClick={() => submitSearch(t)}
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
                      onClick={() => submitSearch(t)}
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

          {showNoResults ? <div className="text-sm text-zinc-500">No results found. Try a different search.</div> : null}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((set) => (
              <div key={set.set_num} className="h-full">
                <SetCard set={set as unknown as SetCardSetProp} />
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
                onPageChange={changePage}
              />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}