// frontend_next/app/themes/[themeSlug]/ThemeDetailClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { slugToTheme } from "@/lib/slug";
import { isRecord } from "@/lib/types";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import Pagination from "@/app/components/Pagination";
import { SetGridSkeleton } from "@/app/components/Skeletons";
import { useAuth } from "@/app/providers";
import { useCollectionStatus } from "@/lib/useCollectionStatus";

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  theme?: string | null;
  image_url?: string | null;
  rating_count?: number | null;
  rating_avg?: number | null;
  average_rating?: number | null;
};

type SetCardSetProp = React.ComponentProps<typeof SetCard>["set"];

function toSetCardSet(s: SetSummary): SetCardSetProp {
  return {
    set_num: s.set_num,
    name: s.name,
    year: s.year,
    pieces: typeof s.pieces === "number" ? s.pieces : null,
    image_url: typeof s.image_url === "string" ? s.image_url : null,
    rating_count: typeof s.rating_count === "number" ? s.rating_count : null,
    rating_avg: typeof s.rating_avg === "number" ? s.rating_avg : null,
    average_rating: typeof s.average_rating === "number" ? s.average_rating : null,
  } as unknown as SetCardSetProp;
}

const PAGE_SIZE = 36;

type SortValue =
  | "year_desc"
  | "year_asc"
  | "rating_desc"
  | "rating_asc"
  | "pieces_desc"
  | "pieces_asc"
  | "name_asc"
  | "name_desc";

function parseSortValue(v: SortValue): { sort: string; order: string } {
  const [sort, order] = v.split("_");
  return { sort, order };
}

function isSetSummary(x: unknown): x is SetSummary {
  if (!isRecord(x)) return false;
  const sn = x.set_num;
  const name = x.name;
  return typeof sn === "string" && sn.trim().length > 0 && typeof name === "string" && name.trim().length > 0;
}

function toSetSummaryArray(x: unknown): SetSummary[] {
  if (Array.isArray(x)) return x.filter(isSetSummary);
  if (isRecord(x)) {
    const r = x.results;
    return Array.isArray(r) ? r.filter(isSetSummary) : [];
  }
  return [];
}

export default function ThemeDetailClient(props: {
  themeSlug: string;
  initialSets: SetSummary[];
  initialTotal: number;
}) {
  const { themeSlug, initialSets, initialTotal } = props;
  const { token } = useAuth();
  const { isOwned, isWishlist } = useCollectionStatus();

  const themeName = useMemo(() => slugToTheme(themeSlug), [themeSlug]);

  const [sets, setSets] = useState<SetSummary[]>(initialSets);
  const [total, setTotal] = useState(initialTotal || initialSets.length);
  const [page, setPage] = useState(1);
  const [sortValue, setSortValue] = useState<SortValue>("year_desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active vs all: active = sets from the last 3 years
  const [showAll, setShowAll] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reqKeyRef = useRef(0);

  const fetchSets = useCallback(async (pg: number, sv: SortValue, all: boolean) => {
    const reqId = ++reqKeyRef.current;
    setLoading(true);
    setError(null);

    try {
      const { sort, order } = parseSortValue(sv);
      const qs = new URLSearchParams();
      qs.set("page", String(pg));
      qs.set("limit", String(PAGE_SIZE));
      qs.set("sort", sort);
      qs.set("order", order);

      if (!all) {
        const currentYear = new Date().getFullYear();
        const minYear = currentYear - 2;
        qs.set("min_year", String(minYear));
      }

      const url = `/api/themes/${themeSlug}/sets?${qs.toString()}`;
      const res = await fetch(url, { cache: "no-store" });

      if (reqKeyRef.current !== reqId) return;

      if (!res.ok) {
        setError(`Couldn't load sets (HTTP ${res.status})`);
        return;
      }

      const totalHeader = res.headers.get("x-total-count");
      const totalCount = totalHeader ? parseInt(totalHeader, 10) : 0;

      const data: unknown = await res.json().catch(() => null);
      const rows = toSetSummaryArray(data);

      setSets(rows);
      setTotal(totalCount || rows.length);
    } catch {
      if (reqKeyRef.current === reqId) {
        setError("Couldn't load sets. Please try again.");
      }
    } finally {
      if (reqKeyRef.current === reqId) {
        setLoading(false);
      }
    }
  }, [themeSlug]);

  // Re-fetch when sort, page, or active/all changes (skip initial render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // On mount, fetch with default sort (year_desc) since server used "relevance"
      fetchSets(1, "year_desc", false);
      return;
    }
    fetchSets(page, sortValue, showAll);
  }, [page, sortValue, showAll, fetchSets]);

  function handleSortChange(v: SortValue) {
    setSortValue(v);
    setPage(1);
  }

  function handlePageChange(p: number) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleToggleAll() {
    setShowAll(!showAll);
    setPage(1);
  }

  const cardSets = useMemo(() => sets.map(toSetCardSet), [sets]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-500">
          {total.toLocaleString()} {total === 1 ? "set" : "sets"}
        </div>

        <div className="flex items-center gap-3">
          {/* Active / All toggle */}
          <button
            type="button"
            onClick={handleToggleAll}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
              showAll
                ? "border-zinc-300 bg-zinc-100 text-zinc-700"
                : "border-amber-500 bg-amber-500 text-black"
            }`}
          >
            {showAll ? "All sets" : "Active sets"}
          </button>

          {/* Sort select */}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Sort</span>
            <select
              value={sortValue}
              onChange={(e) => handleSortChange(e.target.value as SortValue)}
              disabled={loading}
              className="h-10 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold"
            >
              <option value="year_desc">Year (new → old)</option>
              <option value="year_asc">Year (old → new)</option>
              <option value="rating_desc">Rating (high → low)</option>
              <option value="rating_asc">Rating (low → high)</option>
              <option value="pieces_desc">Pieces (high → low)</option>
              <option value="pieces_asc">Pieces (low → high)</option>
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
            </select>
          </label>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="mt-6"><SetGridSkeleton count={12} /></div>}

      {/* Error */}
      {error && !loading && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results grid */}
      {!loading && sets.length > 0 && (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
          {cardSets.map((setForCard, idx) => {
            const original = sets[idx];
            return (
              <div key={original.set_num} className="h-full">
                <SetCard
                  set={setForCard}
                  footer={
                    token ? (
                      <SetCardActions
                        token={token}
                        setNum={original.set_num}
                        isOwned={isOwned(original.set_num)}
                        isWishlist={isWishlist(original.set_num)}
                      />
                    ) : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sets.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-sm text-zinc-500">
            No {showAll ? "" : "active "}sets found for this theme.
          </p>
          {!showAll && (
            <button
              type="button"
              onClick={handleToggleAll}
              className="mt-3 text-sm font-semibold text-amber-600 hover:underline"
            >
              Show all sets →
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          disabled={loading}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
