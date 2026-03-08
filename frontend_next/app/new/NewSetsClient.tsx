// frontend_next/app/new/NewSetsClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { formatPrice } from "@/lib/format";
import { useAuth } from "@/app/providers";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import type { MonthKey } from "./featuredThemes";
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

function formatLaunchDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Hero Spotlight
// ---------------------------------------------------------------------------

function HeroSpotlight({ set }: { set: SetLite }) {
  const sn = String(set.set_num || "").trim();
  const imgSrc = isSafeNextImageSrc(set.image_url) ? set.image_url!.trim() : null;
  const pieces = typeof set.pieces === "number" ? set.pieces : null;
  const price = typeof set.retail_price === "number" ? set.retail_price : null;

  return (
    <Link
      href={`/sets/${sn}`}
      prefetch={false}
      className="mt-6 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white shadow-sm transition-colors hover:border-zinc-300 sm:flex-row"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full shrink-0 bg-white sm:aspect-square sm:w-[280px]">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={set.name || "Set image"}
            fill
            sizes="(max-width: 640px) 100vw, 280px"
            className="object-contain p-6"
            quality={80}
            loading="eager"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-300">No image</div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col justify-center px-6 py-5 sm:py-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">Spotlight</div>
        <h2 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">{set.name}</h2>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
          {set.theme ? <span>{set.theme}</span> : null}
          {pieces ? <span>{pieces.toLocaleString()} pieces</span> : null}
          {price ? <span className="font-semibold text-zinc-900">{formatPrice(price, "USD")}</span> : null}
        </div>

        {set.launch_date ? (
          <div className="mt-2 text-xs text-zinc-400">Launched {formatLaunchDate(set.launch_date)}</div>
        ) : null}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortValue = "launch_desc" | "launch_asc" | "pieces_desc" | "pieces_asc" | "name_asc" | "name_desc";

function sortSets(sets: SetLite[], sort: SortValue): SetLite[] {
  const copy = [...sets];
  switch (sort) {
    case "launch_desc":
      return copy.sort((a, b) => (b.launch_date || "").localeCompare(a.launch_date || ""));
    case "launch_asc":
      return copy.sort((a, b) => (a.launch_date || "").localeCompare(b.launch_date || ""));
    case "pieces_desc":
      return copy.sort((a, b) => (b.pieces ?? 0) - (a.pieces ?? 0));
    case "pieces_asc":
      return copy.sort((a, b) => (a.pieces ?? 0) - (b.pieces ?? 0));
    case "name_asc":
      return copy.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    case "name_desc":
      return copy.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    default:
      return copy;
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function NewSetsClient({
  initialSets,
  initialError,
  monthKey,
  featuredThemes,
  spotlightSetNum,
}: {
  initialSets: SetLite[];
  initialError: string | null;
  monthKey: MonthKey;
  featuredThemes: string[];
  spotlightSetNum?: string | null;
}) {
  const { token } = useAuth();
  const { ownedSetNums, wishlistSetNums, isOwned, isWishlist } = useCollectionStatus();

  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [sort, setSort] = useState<SortValue>("launch_desc");

  const allSets = useMemo(() => (Array.isArray(initialSets) ? initialSets : []), [initialSets]);

  // Hero: admin-pinned set, or biggest set from the most recent launch date
  const heroSet = useMemo(() => {
    if (!allSets.length) return null;

    if (spotlightSetNum) {
      const pinned = allSets.find((s) => s.set_num === spotlightSetNum);
      if (pinned) return pinned;
    }

    const latestDate = allSets[0]?.launch_date;
    if (!latestDate) return null;
    const latestWave = allSets.filter((s) => s.launch_date === latestDate);
    let best: SetLite | null = null;
    for (const s of latestWave) {
      const p = typeof s.pieces === "number" ? s.pieces : 0;
      if (!best || p > (best.pieces ?? 0)) best = s;
    }
    return best;
  }, [allSets, spotlightSetNum]);

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

  // Filter by theme, then sort
  const displaySets = useMemo(() => {
    const filtered = activeTheme
      ? allSets.filter((s) => s.theme === activeTheme)
      : allSets;
    return sortSets(filtered, sort);
  }, [allSets, activeTheme, sort]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* Header */}
      <div className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">New LEGO releases</h1>
        <div className="mt-2 text-sm text-zinc-500">
          {displaySets.length.toLocaleString()} {displaySets.length === 1 ? "set" : "sets"}
          {activeTheme ? ` in ${activeTheme}` : ""}
        </div>

        {initialError ? <p className="mt-4 text-sm text-red-600">Error loading sets: {initialError}</p> : null}
      </div>

      {!initialError && allSets.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No sets found.</p>
      ) : null}

      {/* Hero Spotlight */}
      {heroSet ? <HeroSpotlight set={heroSet} /> : null}

      {/* Controls: theme pills + sort */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {/* Theme pills */}
        <div className="overflow-x-auto pb-1 scrollbar-thin">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTheme(null)}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                activeTheme === null
                  ? "border-amber-500 bg-amber-500 text-black"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              All
            </button>
            {topThemes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTheme(t)}
                className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  activeTheme === t
                    ? "border-amber-500 bg-amber-500 text-black"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-500">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortValue)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="launch_desc">Launch date (new → old)</option>
            <option value="launch_asc">Launch date (old → new)</option>
            <option value="pieces_desc">Pieces (high → low)</option>
            <option value="pieces_asc">Pieces (low → high)</option>
            <option value="name_asc">Name (A → Z)</option>
            <option value="name_desc">Name (Z → A)</option>
          </select>
        </label>
      </div>

      {/* Set grid */}
      {displaySets.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center py-16 text-center">
          <div className="text-lg font-semibold text-zinc-600">No sets found</div>
          <p className="mt-1 text-sm text-zinc-500">Try selecting a different theme</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,220px)] gap-4">
          {displaySets.map((s) => {
            const sn = String(s.set_num || "").trim();
            if (!sn) return null;

            return (
              <div key={sn}>
                <SetCard
                  set={toSetCardSet(s)}
                  footer={
                    token ? (
                      <SetCardActions
                        token={token}
                        setNum={sn}
                        isOwned={isOwned(sn)}
                        isWishlist={isWishlist(sn)}
                      />
                    ) : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
