// frontend_next/app/coming-soon/ComingSoonClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import type { SetLite } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SetCardSet = React.ComponentProps<typeof SetCard>["set"];

function isSafeNextImageSrc(src: unknown): src is string {
  if (typeof src !== "string") return false;
  const s = src.trim();
  if (!s) return false;
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/");
}

function toSetCardSet(s: SetLite): SetCardSet {
  const safeImage = isSafeNextImageSrc(s.image_url) ? s.image_url!.trim() : null;
  return { ...(s as unknown as SetCardSet), image_url: safeImage };
}

function getPieces(s: SetLite): number {
  return typeof s.pieces === "number" ? s.pieces : typeof s.num_parts === "number" ? s.num_parts : 0;
}

function formatLaunchDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw + "T00:00:00");
    if (!Number.isFinite(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Filter Pills
// ---------------------------------------------------------------------------

function FilterPills<T extends string | number>({
  items,
  active,
  onChange,
  allLabel = "All",
}: {
  items: T[];
  active: T | null;
  onChange: (v: T | null) => void;
  allLabel?: string;
}) {
  return (
    <div className="overflow-x-auto pb-1 scrollbar-thin">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
            active === null
              ? "border-amber-500 bg-amber-500 text-black"
              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
          }`}
        >
          {allLabel}
        </button>
        {items.map((item) => (
          <button
            key={String(item)}
            type="button"
            onClick={() => onChange(item)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              active === item
                ? "border-amber-500 bg-amber-500 text-black"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            }`}
          >
            {String(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

type SortKey = "default" | "pieces-desc" | "pieces-asc" | "price-desc" | "price-asc" | "name-asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Launch date" },
  { value: "pieces-desc", label: "Most pieces" },
  { value: "pieces-asc", label: "Fewest pieces" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "name-asc", label: "A\u2013Z" },
];

function sortSets(sets: SetLite[], key: SortKey): SetLite[] {
  if (key === "default") return sets;
  const copy = [...sets];
  switch (key) {
    case "pieces-desc":
      return copy.sort((a, b) => getPieces(b) - getPieces(a));
    case "pieces-asc":
      return copy.sort((a, b) => getPieces(a) - getPieces(b));
    case "price-desc":
      return copy.sort((a, b) => (b.retail_price ?? 0) - (a.retail_price ?? 0));
    case "price-asc":
      return copy.sort((a, b) => (a.retail_price ?? 0) - (b.retail_price ?? 0));
    case "name-asc":
      return copy.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    default:
      return copy;
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ComingSoonClient({
  initialSets,
  initialError,
}: {
  initialSets: SetLite[];
  initialError: string | null;
}) {
  const { token } = useAuth();
  const { ownedSetNums, wishlistSetNums, getUserRating } = useCollectionStatus();
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("default");

  const allSets = useMemo(() => (Array.isArray(initialSets) ? initialSets : []), [initialSets]);

  // Filter by theme
  const filteredSets = useMemo(() => {
    if (!activeTheme) return allSets;
    return allSets.filter((s) => s.theme === activeTheme);
  }, [allSets, activeTheme]);

  // Sort
  const sortedSets = useMemo(() => sortSets(filteredSets, sortKey), [filteredSets, sortKey]);

  // Top themes for pills
  const topThemes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of allSets) {
      const t = typeof s.theme === "string" ? s.theme.trim() : "";
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name]) => name);
  }, [allSets]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* Header */}
      <section className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">Coming Soon</h1>
        <p className="mt-2 max-w-[640px] text-sm text-zinc-500">
          Upcoming LEGO sets that haven&apos;t been released yet. Add them to your wishlist so you don&apos;t miss out.
        </p>

        {initialError ? <p className="mt-4 text-sm text-red-600">Error: {initialError}</p> : null}
      </section>

      {!initialError && allSets.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No upcoming sets right now. Check back soon!</p>
      ) : null}

      {!initialError && allSets.length > 0 ? (
        <section className="mt-8">
          {/* Theme filter pills */}
          {topThemes.length > 1 ? (
            <div className="mb-4">
              <FilterPills items={topThemes} active={activeTheme} onChange={setActiveTheme} allLabel="All themes" />
            </div>
          ) : null}

          {/* Sort + count */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-500">
              {sortedSets.length} {sortedSets.length === 1 ? "set" : "sets"}
              {activeTheme ? ` in ${activeTheme}` : ""}
            </div>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 shadow-sm sm:w-auto"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Grid */}
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
            {sortedSets.length === 0 ? (
              <div className="col-span-full py-10 text-center text-sm text-zinc-400">No sets match your filters.</div>
            ) : (
              sortedSets.map((s) => {
                const sn = String(s.set_num || "").trim();
                if (!sn) return null;

                const isOwn = ownedSetNums.has(sn);
                const isWish = !isOwn && wishlistSetNums.has(sn);
                const launchLabel = formatLaunchDate(s.launch_date);

                const footer = (
                  <div className="space-y-2">
                    {launchLabel ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                        {launchLabel}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                        Date TBD
                      </span>
                    )}
                    <SetCardActions token={token ?? null} setNum={sn} isOwned={isOwn} isWishlist={isWish} />
                  </div>
                );

                return (
                  <div key={sn} className="w-[220px]">
                    <SetCard set={toSetCardSet(s)} token={token ?? undefined} isOwnedByUser={isOwn} userRatingOverride={getUserRating(sn)} footer={footer} />
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
