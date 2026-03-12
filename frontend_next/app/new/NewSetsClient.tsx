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

function getPieces(s: SetLite): number {
  return typeof s.pieces === "number" ? s.pieces : 0;
}

function formatMonthYear(raw: string): string {
  try {
    const [y, m] = raw.split("-");
    const yn = Number(y);
    const mn = Number(m);
    if (!Number.isFinite(yn) || !Number.isFinite(mn)) return raw;
    const d = new Date(yn, mn - 1, 1);
    if (!Number.isFinite(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return raw;
  }
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Hero Spotlight
// ---------------------------------------------------------------------------

function HeroSpotlight({ set }: { set: SetLite }) {
  const sn = String(set.set_num || "").trim();
  const imgSrc = isSafeNextImageSrc(set.image_url) ? set.image_url!.trim() : null;
  const pieces = typeof set.pieces === "number" ? set.pieces : null;
  const price = typeof set.original_price === "number" ? set.original_price : typeof set.retail_price === "number" ? set.retail_price : null;

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
          <div className="mt-2 text-xs text-zinc-400">
            Launched {formatMonthYear(set.launch_date.slice(0, 7))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Stats Bar
// ---------------------------------------------------------------------------

function StatsBar({ sets }: { sets: SetLite[] }) {
  const thisMonth = currentMonthKey();

  const thisMonthCount = useMemo(
    () => sets.filter((s) => (s.launch_date || "").startsWith(thisMonth)).length,
    [sets, thisMonth],
  );

  const biggestSet = useMemo(() => {
    let best: SetLite | null = null;
    let bestPieces = -1;
    for (const s of sets) {
      const p = getPieces(s);
      if (p > bestPieces) {
        bestPieces = p;
        best = s;
      }
    }
    return best;
  }, [sets]);

  const themeCount = useMemo(() => {
    const themes = new Set<string>();
    for (const s of sets) {
      if (s.theme) themes.add(s.theme);
    }
    return themes.size;
  }, [sets]);

  const biggestPieces = biggestSet ? getPieces(biggestSet) : 0;
  const biggestImg = biggestSet && isSafeNextImageSrc(biggestSet.image_url) ? biggestSet.image_url!.trim() : null;
  const biggestPrice = biggestSet && typeof biggestSet.retail_price === "number" ? biggestSet.retail_price : null;

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Released this month */}
      <div className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-2xl font-extrabold tracking-tight text-zinc-900">{thisMonthCount}</span>
        <div className="mt-0.5 text-[11px] font-medium text-zinc-500">Released {formatMonthYear(thisMonth)}</div>
      </div>

      {/* Theme count */}
      <div className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-2xl font-extrabold tracking-tight text-zinc-900">{themeCount}</span>
        <div className="mt-0.5 text-[11px] font-medium text-zinc-500">Themes</div>
      </div>

      {/* Biggest set — spans 2 columns */}
      {biggestSet ? (
        <Link
          href={`/sets/${biggestSet.set_num}`}
          prefetch={false}
          className="col-span-2 flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-zinc-300"
        >
          {biggestImg ? (
            <div className="relative h-16 w-16 shrink-0">
              <Image
                src={biggestImg}
                alt={biggestSet.name || "Set image"}
                fill
                sizes="64px"
                className="object-contain"
                quality={75}
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-zinc-500">Biggest new release</div>
            <div className="mt-0.5 truncate text-sm font-bold text-zinc-900">{biggestSet.name}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
              <span>{biggestPieces.toLocaleString()} pieces</span>
              {biggestPrice ? <span className="font-semibold text-zinc-700">{formatPrice(biggestPrice, "USD")}</span> : null}
            </div>
          </div>
        </Link>
      ) : (
        <div className="col-span-2 flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm text-zinc-400">No set data</span>
        </div>
      )}
    </div>
  );
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

type SortKey = "default" | "pieces-desc" | "pieces-asc" | "price-desc" | "price-asc" | "name-asc" | "rating-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "pieces-desc", label: "Most pieces" },
  { value: "pieces-asc", label: "Fewest pieces" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "name-asc", label: "A\u2013Z" },
  { value: "rating-desc", label: "Highest rated" },
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
    case "rating-desc":
      return copy.sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0));
    default:
      return copy;
  }
}

// ---------------------------------------------------------------------------
// Monthly Release Section (grouped by launch month, with per-section sort)
// ---------------------------------------------------------------------------

function MonthlyReleaseSection({
  monthKey,
  sets,
  owned,
  wish,
  token,
  getUserRating,
}: {
  monthKey: string;
  sets: SetLite[];
  owned: Set<string>;
  wish: Set<string>;
  token: string | null;
  getUserRating: (s: string) => number | null;
}) {
  const [sectionSort, setSectionSort] = useState<SortKey>("default");

  const isCurrentMonth = monthKey === currentMonthKey();

  const sorted = useMemo(() => sortSets(sets, sectionSort), [sets, sectionSort]);

  return (
    <div>
      <div className="flex flex-col gap-2 px-1 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="m-0 text-xl font-bold text-zinc-900">{formatMonthYear(monthKey)}</h3>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isCurrentMonth
              ? "bg-amber-50 text-amber-700"
              : "bg-zinc-50 text-zinc-600"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isCurrentMonth ? "bg-amber-500" : "bg-zinc-400"}`} />
            {sets.length} {sets.length === 1 ? "set" : "sets"}
          </span>
        </div>

        <select
          value={sectionSort}
          onChange={(e) => setSectionSort(e.target.value as SortKey)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 shadow-sm sm:w-auto"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
        {sorted.map((s) => {
          const sn = String(s.set_num || "").trim();
          if (!sn) return null;

          const isOwn = owned.has(sn);
          const isWish = !isOwn && wish.has(sn);

          return (
            <div key={sn} className="w-[220px]">
              <SetCard
                set={toSetCardSet(s)}
                token={token ?? undefined}
                isOwnedByUser={isOwn}
                userRatingOverride={getUserRating(sn)}
                footer={
                  token ? (
                    <SetCardActions token={token} setNum={sn} isOwned={isOwn} isWishlist={isWish} />
                  ) : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function NewSetsClient({
  initialSets,
  initialError,
  monthKey: _monthKey,
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
  const { ownedSetNums, wishlistSetNums, isOwned, isWishlist, getUserRating } = useCollectionStatus();

  const [activeTheme, setActiveTheme] = useState<string | null>(null);

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

  // Top themes for pills — prioritize featured themes, then fill with most popular
  const topThemes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of allSets) {
      const t = typeof s.theme === "string" ? s.theme.trim() : "";
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }

    // Start with featured themes that actually exist in the data
    const result: string[] = [];
    for (const ft of featuredThemes) {
      if (counts.has(ft) && !result.includes(ft)) {
        result.push(ft);
      }
    }

    // Fill remaining spots with most popular themes
    const remaining = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .filter((name) => !result.includes(name));

    for (const name of remaining) {
      if (result.length >= 12) break;
      result.push(name);
    }

    return result;
  }, [allSets, featuredThemes]);

  // Filter by theme
  const filteredSets = useMemo(() => {
    if (!activeTheme) return allSets;
    return allSets.filter((s) => s.theme === activeTheme);
  }, [allSets, activeTheme]);

  // Group by launch month (newest first)
  const monthlyGroups = useMemo(() => {
    const map = new Map<string, SetLite[]>();
    for (const s of filteredSets) {
      const mk = s.launch_date ? s.launch_date.slice(0, 7) : "Unknown";
      if (!map.has(mk)) map.set(mk, []);
      map.get(mk)!.push(s);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === "Unknown") return 1;
      if (b[0] === "Unknown") return -1;
      return b[0].localeCompare(a[0]); // newest first
    });
  }, [filteredSets]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* Header */}
      <section className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">New LEGO releases</h1>
        <p className="mt-2 max-w-[640px] text-sm text-zinc-500">
          Browse the latest LEGO sets, organized by release month. Filter by theme to find exactly what you&apos;re looking for.
        </p>

        {initialError ? <p className="mt-4 text-sm text-red-600">Error loading sets: {initialError}</p> : null}
      </section>

      {!initialError && allSets.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No sets found.</p>
      ) : null}

      {!initialError && allSets.length > 0 ? (
        <>
          {/* Stats */}
          <StatsBar sets={allSets} />

          {/* Hero Spotlight */}
          {heroSet ? <HeroSpotlight set={heroSet} /> : null}

          {/* Browse Section */}
          <section className="mt-10">
            <h2 className="m-0 text-lg font-semibold text-zinc-900">Browse by theme</h2>

            <div className="mt-3">
              <FilterPills items={topThemes} active={activeTheme} onChange={setActiveTheme} allLabel="All themes" />
            </div>

            {/* Result count */}
            <div className="mt-4 text-sm text-zinc-500">
              {filteredSets.length} {filteredSets.length === 1 ? "set" : "sets"}
              {activeTheme ? ` in ${activeTheme}` : ""}
            </div>

            {/* Monthly groups with per-section sort */}
            <div className="mt-6 space-y-12">
              {monthlyGroups.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400">No sets match your filters.</div>
              ) : (
                monthlyGroups.map(([mk, monthSets]) => (
                  <MonthlyReleaseSection
                    key={mk}
                    monthKey={mk}
                    sets={monthSets}
                    owned={ownedSetNums}
                    wish={wishlistSetNums}
                    token={token ?? null}
                    getUserRating={getUserRating}
                  />
                ))
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
