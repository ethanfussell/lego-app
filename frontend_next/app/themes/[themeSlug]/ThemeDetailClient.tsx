// frontend_next/app/themes/[themeSlug]/ThemeDetailClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ThemesClient from "../ThemesClient";

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  image_url?: string | null;
  rating_count?: number | null;
  rating_avg?: number | null;
  average_rating?: number | null;
};

const DEFAULT_LIMIT = 36;
const MAX_LIMIT = 72;

// Match API (default is "relevance")
const ALLOWED_SORTS = new Set(["relevance", "year", "pieces", "name", "rating"] as const);
type SortKey = "relevance" | "year" | "pieces" | "name" | "rating";

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function first(sp: URLSearchParams, key: string): string {
  return (sp.get(key) ?? "").trim();
}

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function clampInt(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function sanitizeSort(raw: string): SortKey {
  const s = (raw || "").trim();
  return (ALLOWED_SORTS.has(s as SortKey) ? (s as SortKey) : "relevance") as SortKey;
}

function defaultOrderForSort(sort: SortKey): "asc" | "desc" {
  // relevance: high -> low (desc)
  // rating: high -> low
  // year: new -> old
  // pieces: high -> low
  // name: A -> Z
  return sort === "name" ? "asc" : "desc";
}

function sanitizeOrder(raw: string): "asc" | "desc" | "" {
  const o = (raw || "").trim();
  if (o === "asc" || o === "desc") return o;
  return "";
}

function isSetSummary(x: unknown): x is SetSummary {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { set_num?: unknown; name?: unknown };
  return typeof o.set_num === "string" && o.set_num.trim() !== "" && typeof o.name === "string";
}

function toSetSummaryArray(x: unknown): SetSummary[] {
  if (Array.isArray(x)) return x.filter(isSetSummary);

  if (typeof x === "object" && x !== null) {
    const r = (x as { results?: unknown }).results;
    return Array.isArray(r) ? r.filter(isSetSummary) : [];
  }

  return [];
}

function totalPagesFrom(totalCount: number | null, limit: number) {
  if (!totalCount || totalCount <= 0) return null;
  return Math.max(1, Math.ceil(totalCount / Math.max(1, limit)));
}

/**
 * Build a compact pager like:
 * 1 … 6 7 [8] 9 10 … 42
 */
function buildPageList(current: number, totalPages: number) {
  const out: Array<number | "..."> = [];
  const add = (x: number | "...") => {
    if (out.length === 0 || out[out.length - 1] !== x) out.push(x);
  };

  const window = 2; // pages around current
  const start = Math.max(2, current - window);
  const end = Math.min(totalPages - 1, current + window);

  add(1);

  if (start > 2) add("...");

  for (let p = start; p <= end; p++) add(p);

  if (end < totalPages - 1) add("...");

  if (totalPages > 1) add(totalPages);

  return out;
}

export default function ThemeDetailClient({
  themeSlug,
  initialSets = [],
}: {
  themeSlug: string;
  initialSets?: SetSummary[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  // IMPORTANT: themeSlug is the URL segment; decode it to get raw theme string for the API
  const theme = useMemo(() => decodeURIComponent(String(themeSlug || "").trim()), [themeSlug]);

  // URL -> state
  const page = useMemo(() => {
    const p = toInt(first(sp, "page") || "1", 1);
    return Math.max(1, p);
  }, [sp]);

  const limit = useMemo(() => {
    const raw = toInt(first(sp, "limit") || String(DEFAULT_LIMIT), DEFAULT_LIMIT);
    return clampInt(raw, 1, MAX_LIMIT);
  }, [sp]);

  const sort = useMemo(() => sanitizeSort(first(sp, "sort") || "relevance"), [sp]);
  const order = useMemo(() => sanitizeOrder(first(sp, "order") || ""), [sp]);

  const effectiveOrder = order || defaultOrderForSort(sort);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sets, setSets] = useState<SetSummary[]>(initialSets);

  // total count + pages (from X-Total-Count)
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const totalPages = useMemo(() => totalPagesFrom(totalCount, limit), [totalCount, limit]);

  // fallback if header missing: infer next by “filled the page”
  const [hasNextFallback, setHasNextFallback] = useState(initialSets.length === limit);

  const hasPrev = page > 1;
  const hasNext = totalPages != null ? page < totalPages : hasNextFallback;

  function pushUrl(next: { page?: number; limit?: number; sort?: SortKey; order?: "asc" | "desc" | "" }) {
    const params = new URLSearchParams(sp?.toString?.() || "");

    if (typeof next.page === "number") {
      const p = Number.isFinite(next.page) ? Math.floor(next.page) : 1;
      if (p <= 1) params.delete("page");
      else params.set("page", String(p));
    }

    if (typeof next.limit === "number") {
      const l0 = Number.isFinite(next.limit) ? Math.floor(next.limit) : DEFAULT_LIMIT;
      const l = clampInt(l0, 1, MAX_LIMIT);
      if (l === DEFAULT_LIMIT) params.delete("limit");
      else params.set("limit", String(l));
    }

    if (typeof next.sort === "string") {
      const s = sanitizeSort(next.sort);
      if (s === "relevance") params.delete("sort"); // default
      else params.set("sort", s);
    }

    if (typeof next.order === "string") {
      const o = sanitizeOrder(next.order);
      const currentSort = sanitizeSort(params.get("sort") || "relevance");
      const def = defaultOrderForSort(currentSort);

      if (!o || o === def) params.delete("order"); // default
      else params.set("order", o);
    }

    const qs = params.toString();

    // ✅ DO NOT re-encode themeSlug (it may already be encoded)
    const url = qs ? `/themes/${themeSlug}?${qs}` : `/themes/${themeSlug}`;
    router.push(url, { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!theme) return;

      try {
        setLoading(true);
        setErr(null);

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));

        // only send sort/order when needed
        if (sort !== "relevance") params.set("sort", sort);

        const def = defaultOrderForSort(sort);
        if (effectiveOrder !== def) params.set("order", effectiveOrder);

        // ✅ browser request via Next proxy so no CORS + we can read headers
        const url = `/api/themes/${encodeURIComponent(theme)}/sets?${params.toString()}`;
        const resp = await fetch(url, { cache: "no-store" });

        if (resp.status === 404) {
          // Theme not found (or backend says not found) — show empty + back
          if (!cancelled) {
            setSets([]);
            setTotalCount(null);
            setHasNextFallback(false);
            setErr("Theme not found.");
          }
          return;
        }

        if (!resp.ok) {
          throw new Error(`${resp.status} ${resp.statusText}`);
        }

        const raw: unknown = await resp.json();
        const results = toSetSummaryArray(raw);

        const header = resp.headers.get("x-total-count") || resp.headers.get("X-Total-Count");
        const parsed = header ? Number(header) : NaN;
        const total = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

        if (cancelled) return;

        setSets(results);
        setTotalCount(total);
        setHasNextFallback(results.length === limit);
      } catch (e: unknown) {
        if (!cancelled) {
          setSets([]);
          setTotalCount(null);
          setHasNextFallback(false);
          setErr(errorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, page, limit, sort, effectiveOrder]);

  const pageList = useMemo(() => {
    if (!totalPages || totalPages <= 1) return [];
    return buildPageList(page, totalPages);
  }, [page, totalPages]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{theme || "Theme"}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span>
              Page {page}
              {totalPages ? <span className="ml-1">of {totalPages}</span> : null}
              {typeof totalCount === "number" ? <span className="ml-2">• {totalCount} sets</span> : null}
            </span>

            <label className="flex items-center gap-2">
              <span className="text-zinc-500">Sort</span>
              <select
                value={`${sort}:${effectiveOrder}`}
                onChange={(e) => {
                  const raw = String(e.target.value || "");
                  const [s0, o0] = raw.split(":");
                  const s = sanitizeSort(s0);
                  const o = sanitizeOrder(o0) || defaultOrderForSort(s);
                  pushUrl({ sort: s, order: o, page: 1 });
                }}
                className="h-10 rounded-2xl border border-black/[.10] bg-white px-3 text-sm font-semibold dark:border-white/[.14] dark:bg-zinc-950"
              >
                <option value={`relevance:desc`}>Relevance</option>

                <option value={`rating:desc`}>Rating (high → low)</option>
                <option value={`rating:asc`}>Rating (low → high)</option>

                <option value={`year:desc`}>Year (new → old)</option>
                <option value={`year:asc`}>Year (old → new)</option>

                <option value={`pieces:desc`}>Pieces (high → low)</option>
                <option value={`pieces:asc`}>Pieces (low → high)</option>

                <option value={`name:asc`}>Name (A → Z)</option>
                <option value={`name:desc`}>Name (Z → A)</option>
              </select>
            </label>
          </div>
        </div>

        <Link href="/themes" className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
          ← All themes
        </Link>
      </div>

      {loading ? <p className="mt-6 text-sm">Loading…</p> : null}
      {err && !loading ? (
        <div className="mt-6">
          <p className="text-sm text-red-600">Error: {err}</p>
          <Link href="/themes" className="mt-3 inline-block text-sm font-semibold hover:underline">
            ← Back to themes
          </Link>
        </div>
      ) : null}
      
      {!loading && !err && sets.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No sets found for this theme yet.</p>
      ) : null}

      {!err && sets.length > 0 ? <ThemesClient sets={sets} /> : null}

      {/* Pagination */}
      {!err ? (
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pushUrl({ page: page - 1 })}
              disabled={!hasPrev}
              className={`rounded-full border border-black/[.12] px-4 py-2 text-sm dark:border-white/[.2] ${
                !hasPrev ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              ← Prev
            </button>

            <button
              type="button"
              onClick={() => pushUrl({ page: page + 1 })}
              disabled={!hasNext}
              className={`rounded-full border border-black/[.12] px-4 py-2 text-sm dark:border-white/[.2] ${
                !hasNext ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              Next →
            </button>
          </div>

          {pageList.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              {pageList.map((p, idx) =>
                p === "..." ? (
                  <span key={`dots-${idx}`} className="px-2 text-sm text-zinc-500">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => pushUrl({ page: p })}
                    aria-current={p === page ? "page" : undefined}
                    className={`h-9 min-w-9 rounded-full border px-3 text-sm font-semibold dark:border-white/[.2] ${
                      p === page
                        ? "border-black/40 bg-black text-white dark:border-white/40 dark:bg-white dark:text-black"
                        : "border-black/[.12] hover:bg-zinc-50 dark:border-white/[.2] dark:hover:bg-zinc-900"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">{hasNext ? "More pages available" : "No more pages"}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}