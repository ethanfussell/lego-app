// frontend_next/app/themes/[themeSlug]/ThemeDetailClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import ThemesClient from "../ThemesClient";

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  image_url?: string | null;
  rating_count?: number | null;
};

type SetsResponse =
  | SetSummary[]
  | {
      results?: SetSummary[];
      total?: number;
      total_results?: number;
      count?: number;
      page?: number;
      total_pages?: number;
      pages?: number;
    };

const DEFAULT_LIMIT = 30;

const ALLOWED_SORTS = new Set(["rating", "year", "pieces", "name"] as const);
type SortKey = "rating" | "year" | "pieces" | "name";

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

function sanitizeSort(raw: string): SortKey {
  const s = (raw || "").trim();
  return (ALLOWED_SORTS.has(s as SortKey) ? (s as SortKey) : "rating") as SortKey;
}

function defaultOrderForSort(sort: SortKey): "asc" | "desc" {
  // good defaults:
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
    const results = (x as { results?: unknown }).results;
    return Array.isArray(results) ? results.filter(isSetSummary) : [];
  }

  return [];
}

function normalizeResponse(data: unknown): { results: SetSummary[]; totalPages: number } {
  // If API returns array
  if (Array.isArray(data)) return { results: toSetSummaryArray(data), totalPages: 1 };

  // If API returns object with results + total_pages/pages
  const obj = (typeof data === "object" && data !== null ? (data as SetsResponse) : null) as SetsResponse | null;

  const results = toSetSummaryArray(obj);

  const pages =
    typeof (obj as { total_pages?: unknown })?.total_pages === "number"
      ? (obj as { total_pages: number }).total_pages
      : typeof (obj as { pages?: unknown })?.pages === "number"
      ? (obj as { pages: number }).pages
      : 1;

  const totalPages = Number.isFinite(pages) && pages > 0 ? Math.floor(pages) : 1;

  return { results, totalPages };
}

export default function ThemeDetailClient({ themeSlug }: { themeSlug: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const theme = useMemo(() => decodeURIComponent(String(themeSlug || "").trim()), [themeSlug]);

  // URL -> state
  const page = useMemo(() => toInt(first(sp, "page") || "1", 1), [sp]);
  const limit = useMemo(() => toInt(first(sp, "limit") || String(DEFAULT_LIMIT), DEFAULT_LIMIT), [sp]);
  const sort = useMemo(() => sanitizeSort(first(sp, "sort") || "rating"), [sp]);
  const order = useMemo(() => sanitizeOrder(first(sp, "order") || ""), [sp]);

  const effectiveOrder = order || defaultOrderForSort(sort);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);

  // keep URL writer small + consistent
  function pushUrl(next: { page?: number; limit?: number; sort?: SortKey; order?: "asc" | "desc" | "" }) {
    const params = new URLSearchParams(sp?.toString?.() || "");

    if (typeof next.page === "number") {
      const p = Number.isFinite(next.page) ? Math.floor(next.page) : 1;
      if (p <= 1) params.delete("page");
      else params.set("page", String(p));
    }

    if (typeof next.limit === "number") {
      const l = Number.isFinite(next.limit) ? Math.floor(next.limit) : DEFAULT_LIMIT;
      if (l === DEFAULT_LIMIT) params.delete("limit");
      else params.set("limit", String(l));
    }

    if (typeof next.sort === "string") {
      const s = sanitizeSort(next.sort);
      if (s === "rating") params.delete("sort"); // keep URL clean (default)
      else params.set("sort", s);
    }

    if (typeof next.order === "string") {
      const o = sanitizeOrder(next.order);
      const currentSort = sanitizeSort(params.get("sort") || "rating");
      const def = defaultOrderForSort(currentSort);

      // keep URL clean: drop order if it matches default
      if (!o || o === def) params.delete("order");
      else params.set("order", o);
    }

    const qs = params.toString();
    const url = qs ? `/themes/${encodeURIComponent(themeSlug)}?${qs}` : `/themes/${encodeURIComponent(themeSlug)}`;
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
        params.set("q", theme);
        params.set("page", String(page));
        params.set("limit", String(limit));
        params.set("sort", sort);
        params.set("order", effectiveOrder);

        const data = await apiFetch<unknown>(`/sets?${params.toString()}`, { cache: "no-store" });
        if (cancelled) return;

        const norm = normalizeResponse(data);
        setSets(norm.results);
        setTotalPages(norm.totalPages);

        // snap back if page too large
        if (page > norm.totalPages && norm.totalPages >= 1) {
          pushUrl({ page: norm.totalPages });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setSets([]);
          setTotalPages(1);
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
  }, [theme, page, limit, sort, effectiveOrder, themeSlug]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{theme || "Theme"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span>
              Page {page}
              {totalPages > 1 ? ` / ${totalPages}` : ""}
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
      {err && !loading ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      {!loading && !err && sets.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No sets found for this theme yet.</p>
      ) : null}

      {!err && sets.length > 0 ? (
        <ThemesClient theme={theme} sets={sets} page={page} limit={limit} sort={`${sort}:${effectiveOrder}`} />
      ) : null}

      {/* Pagination (kept simple + consistent with your ThemesClient URLs) */}
      {!err && totalPages > 1 ? (
        <div className="mt-10 flex items-center justify-between">
          <div>
            {page > 1 ? (
              <button
                type="button"
                onClick={() => pushUrl({ page: page - 1 })}
                className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-zinc-50 dark:border-white/[.2] dark:hover:bg-zinc-900"
              >
                ← Prev
              </button>
            ) : (
              <span />
            )}
          </div>

          <div>
            {page < totalPages ? (
              <button
                type="button"
                onClick={() => pushUrl({ page: page + 1 })}
                className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-zinc-50 dark:border-white/[.2] dark:hover:bg-zinc-900"
              >
                Next →
              </button>
            ) : (
              <span className="text-sm text-zinc-500">No more pages</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}