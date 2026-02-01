// frontend_next/app/themes/[themeSlug]/ThemeDetailClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";

const PAGE_SIZE = 36;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function buildPageItems(page: number, totalPages: number) {
  const items = new Set<number | string>([
    1,
    totalPages,
    page - 2,
    page - 1,
    page,
    page + 1,
    page + 2,
  ]);

  const nums = [...items]
    .filter((p): p is number => typeof p === "number" && p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const out: Array<number | string> = [];
  let prev = 0;
  for (const p of nums) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

function prettyFromSlug(themeSlug: string) {
  const raw = decodeURIComponent(themeSlug || "Theme");
  if (raw.includes(" ")) return raw;
  return raw.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

type LegoSet = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  num_parts?: number;
  theme?: string;
  image_url?: string | null;
  average_rating?: number | null;
  rating_avg?: number | null;
  rating_count?: number | null;
};

type SortKey =
  | "year_desc"
  | "year_asc"
  | "name_asc"
  | "name_desc"
  | "pieces_desc"
  | "pieces_asc";

function sortKeyToBackend(sortKey: SortKey): { sort: "name" | "year" | "pieces"; order: "asc" | "desc" } {
  switch (sortKey) {
    case "name_asc":
      return { sort: "name", order: "asc" };
    case "name_desc":
      return { sort: "name", order: "desc" };
    case "pieces_asc":
      return { sort: "pieces", order: "asc" };
    case "pieces_desc":
      return { sort: "pieces", order: "desc" };
    case "year_asc":
      return { sort: "year", order: "asc" };
    case "year_desc":
    default:
      return { sort: "year", order: "desc" };
  }
}

export default function ThemeDetailClient({ themeSlug }: { themeSlug: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { token } = useAuth();

  const themeName = useMemo(() => prettyFromSlug(themeSlug), [themeSlug]);

  const page = useMemo(() => {
    const raw = parseInt(sp.get("page") || "1", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }, [sp]);

  const sortKey = useMemo(() => {
    const raw = (sp.get("sortKey") || "year_desc").trim() as SortKey;
    const allowed: SortKey[] = ["year_desc", "year_asc", "name_asc", "name_desc", "pieces_desc", "pieces_asc"];
    return allowed.includes(raw) ? raw : "year_desc";
  }, [sp]);

  const { sort, order } = useMemo(() => sortKeyToBackend(sortKey), [sortKey]);

  const [sets, setSets] = useState<LegoSet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
  const safePage = clamp(page, 1, totalPages);
  const pageItems = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages]);

  const makeHref = useCallback(
    (next: Record<string, string | number | null | undefined>) => {
      const u = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "") u.delete(k);
        else u.set(k, String(v));
      }
      const qs = u.toString();
      const base = `/themes/${encodeURIComponent(themeSlug)}`;
      return qs ? `${base}?${qs}` : base;
    },
    [sp, themeSlug]
  );

  const push = useCallback((href: string) => router.push(href), [router]);

  // If URL has an out-of-range page, snap it once total is known
  useEffect(() => {
    if (page !== safePage) push(makeHref({ page: safePage }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  useEffect(() => {
    let cancelled = false;

    async function loadThemeSets() {
      try {
        setLoading(true);
        setError(null);

        const offset = (safePage - 1) * PAGE_SIZE;

        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));
        params.set("sort", sort);
        params.set("order", order);

        // Uses your Next API proxy
        const url = `/api/themes/${encodeURIComponent(themeName)}/sets?${params.toString()}`;

        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Theme sets failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        const items: LegoSet[] = Array.isArray(data) ? data : [];

        const totalCount = parseInt(resp.headers.get("x-total-count") || "0", 10);

        if (!cancelled) {
          setSets(items);
          setTotal(Number.isFinite(totalCount) ? totalCount : 0);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || String(e));
          setSets([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadThemeSets();
    return () => {
      cancelled = true;
    };
  }, [themeName, safePage, sort, order]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-500">Themes / {themeName}</div>
          <h1 className="m-0 text-3xl font-semibold tracking-tight">{themeName}</h1>
          <div className="mt-2 text-sm text-zinc-500">
            {total ? `${total.toLocaleString()} sets` : null}
          </div>
        </div>

        <Link href="/themes" className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
          ← All themes
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-500">
          Page {safePage} {loading ? "· Loading…" : null}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Sort</span>
          <select
            value={sortKey}
            onChange={(e) => push(makeHref({ sortKey: e.target.value, page: 1 }))}
            disabled={loading}
            className="h-10 rounded-2xl border border-black/[.10] bg-white px-3 text-sm font-semibold dark:border-white/[.14] dark:bg-zinc-950"
          >
            <option value="year_desc">Year (new → old)</option>
            <option value="year_asc">Year (old → new)</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="pieces_desc">Pieces (high → low)</option>
            <option value="pieces_asc">Pieces (low → high)</option>
          </select>
        </label>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">Error: {error}</p> : null}
      {!loading && !error && sets.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No sets found for this theme.</p>
      ) : null}

      {/* ✅ Grid */}
      {!error && sets.length > 0 ? (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
          {sets.map((s) => (
            <div key={s.set_num} className="w-[220px]">
              <SetCard
                set={{
                  ...s,
                  // normalize pieces so SetCard always has one
                  pieces: typeof s.pieces === "number" ? s.pieces : typeof s.num_parts === "number" ? s.num_parts : null,
                } as any}
                footer={token ? <SetCardActions token={token} setNum={s.set_num} /> : null}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* ✅ Pagination */}
      {totalPages > 1 ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => push(makeHref({ page: Math.max(1, safePage - 1) }))}
            disabled={safePage <= 1 || loading}
            className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-white/[.2] dark:hover:bg-zinc-900"
          >
            ← Prev
          </button>

          {pageItems.map((it, idx) => {
            if (it === "…") {
              return (
                <span key={`dots-${idx}`} className="px-2 text-sm text-zinc-500">
                  …
                </span>
              );
            }

            const p = it as number;
            const isActive = p === safePage;

            return (
              <button
                key={p}
                type="button"
                onClick={() => push(makeHref({ page: p }))}
                disabled={isActive || loading}
                className={[
                  "h-10 min-w-10 rounded-full border px-3 text-sm font-semibold",
                  "border-black/[.12] dark:border-white/[.2]",
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                    : "bg-white hover:bg-zinc-50 dark:bg-transparent dark:hover:bg-zinc-900",
                  "disabled:opacity-60",
                ].join(" ")}
              >
                {p}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => push(makeHref({ page: Math.min(totalPages, safePage + 1) }))}
            disabled={safePage >= totalPages || loading}
            className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-white/[.2] dark:hover:bg-zinc-900"
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}