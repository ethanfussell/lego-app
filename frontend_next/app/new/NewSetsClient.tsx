// frontend_next/app/new/NewSetsClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import CarouselRow from "@/app/components/CarouselRow";
import { formatPrice } from "@/lib/format";
import { useAuth } from "@/app/providers";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import AdSlot from "@/app/components/AdSlot";
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
  const price =
    typeof set.original_price === "number"
      ? set.original_price
      : typeof set.retail_price === "number"
        ? set.retail_price
        : null;

  return (
    <Link
      href={`/sets/${sn}`}
      prefetch={false}
      className="mt-6 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white shadow-sm transition-colors hover:border-zinc-300 sm:flex-row"
    >
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

      <div className="flex flex-1 flex-col justify-center px-6 py-5 sm:py-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">Spotlight</div>
        <h2 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">{set.name}</h2>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
          {set.theme ? <span>{set.theme}</span> : null}
          {pieces ? <span>{pieces.toLocaleString()} pieces</span> : null}
          {price ? (
            <span className="font-semibold text-zinc-900">{formatPrice(price, "USD")}</span>
          ) : null}
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

  const thisMonthSets = useMemo(
    () => sets.filter((s) => (s.launch_date || "").startsWith(thisMonth)),
    [sets, thisMonth],
  );

  const biggestThisMonth = useMemo(() => {
    let best: SetLite | null = null;
    let bestPieces = -1;
    for (const s of thisMonthSets) {
      const p = getPieces(s);
      if (p > bestPieces) {
        bestPieces = p;
        best = s;
      }
    }
    return best;
  }, [thisMonthSets]);

  const themeCount = useMemo(() => {
    const themes = new Set<string>();
    for (const s of sets) {
      if (s.theme) themes.add(s.theme);
    }
    return themes.size;
  }, [sets]);

  const biggestPieces = biggestThisMonth ? getPieces(biggestThisMonth) : 0;
  const biggestImg =
    biggestThisMonth && isSafeNextImageSrc(biggestThisMonth.image_url)
      ? biggestThisMonth.image_url!.trim()
      : null;
  const biggestPrice =
    biggestThisMonth && typeof biggestThisMonth.retail_price === "number"
      ? biggestThisMonth.retail_price
      : biggestThisMonth && typeof biggestThisMonth.original_price === "number"
        ? biggestThisMonth.original_price
        : null;

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Released this month */}
      <div className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-2xl font-extrabold tracking-tight text-zinc-900">
          {thisMonthSets.length}
        </span>
        <div className="mt-0.5 text-[11px] font-medium text-zinc-500">
          New in {formatMonthYear(thisMonth)}
        </div>
      </div>

      {/* Theme count */}
      <div className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-2xl font-extrabold tracking-tight text-zinc-900">{themeCount}</span>
        <div className="mt-0.5 text-[11px] font-medium text-zinc-500">Themes</div>
      </div>

      {/* Biggest set this month — spans 2 columns */}
      {biggestThisMonth ? (
        <Link
          href={`/sets/${biggestThisMonth.set_num}`}
          prefetch={false}
          className="col-span-2 flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-zinc-300"
        >
          {biggestImg ? (
            <div className="relative h-16 w-16 shrink-0">
              <Image
                src={biggestImg}
                alt={biggestThisMonth.name || "Set image"}
                fill
                sizes="64px"
                className="object-contain"
                quality={75}
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-zinc-500">
              Most pieces this month
            </div>
            <div className="mt-0.5 truncate text-sm font-bold text-zinc-900">
              {biggestThisMonth.name}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
              <span>{biggestPieces.toLocaleString()} pieces</span>
              {biggestPrice ? (
                <span className="font-semibold text-zinc-700">
                  {formatPrice(biggestPrice, "USD")}
                </span>
              ) : null}
            </div>
          </div>
        </Link>
      ) : (
        <div className="col-span-2 flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm text-zinc-400">No new sets this month yet</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Featured Themes Section
// ---------------------------------------------------------------------------

function FeaturedThemesSection({
  themes,
  sets,
  owned,
  wish,
  token,
  getUserRating,
}: {
  themes: string[];
  sets: SetLite[];
  owned: Set<string>;
  wish: Set<string>;
  token: string | null;
  getUserRating: (s: string) => number | null;
}) {
  // Group sets by featured theme
  const themeSets = useMemo(() => {
    const result: { theme: string; sets: SetLite[] }[] = [];
    for (const theme of themes) {
      const matching = sets
        .filter((s) => s.theme === theme)
        .sort((a, b) => (b.launch_date || "").localeCompare(a.launch_date || ""));
      if (matching.length > 0) {
        result.push({ theme, sets: matching });
      }
    }
    return result;
  }, [themes, sets]);

  if (themeSets.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="m-0 mb-4 text-lg font-semibold text-zinc-900">Featured themes</h2>

      <div className="space-y-4">
        {themeSets.map(({ theme, sets: ts }) => (
          <CarouselRow
            key={theme}
            title={theme}
            subtitle={`${ts.length} ${ts.length === 1 ? "set" : "sets"}`}
            emptyText="No sets found."
          >
            {ts.map((s) => {
              const sn = String(s.set_num || "").trim();
              if (!sn) return null;
              const isOwn = owned.has(sn);
              const isWish = !isOwn && wish.has(sn);

              return (
                <div key={sn} className="w-[220px] shrink-0">
                  <SetCard
                    set={toSetCardSet(s)}
                    token={token ?? undefined}
                    isOwnedByUser={isOwn}
                    userRatingOverride={getUserRating(sn)}
                    footer={
                      token ? (
                        <SetCardActions
                          token={token}
                          setNum={sn}
                          isOwned={isOwn}
                          isWishlist={isWish}
                        />
                      ) : undefined
                    }
                  />
                </div>
              );
            })}
          </CarouselRow>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

type SortKey =
  | "default"
  | "pieces-desc"
  | "pieces-asc"
  | "price-desc"
  | "price-asc"
  | "name-asc"
  | "rating-desc";

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
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isCurrentMonth ? "bg-amber-50 text-amber-700" : "bg-zinc-50 text-zinc-600"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isCurrentMonth ? "bg-amber-500" : "bg-zinc-400"
              }`}
            />
            {sets.length} {sets.length === 1 ? "set" : "sets"}
          </span>
        </div>

        <select
          value={sectionSort}
          onChange={(e) => setSectionSort(e.target.value as SortKey)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 shadow-sm sm:w-auto"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
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
                    <SetCardActions
                      token={token}
                      setNum={sn}
                      isOwned={isOwn}
                      isWishlist={isWish}
                    />
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
  const { ownedSetNums, wishlistSetNums, isOwned, isWishlist, getUserRating } =
    useCollectionStatus();

  const allSets = useMemo(
    () => (Array.isArray(initialSets) ? initialSets : []),
    [initialSets],
  );

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

  // Group by launch month (newest first)
  const monthlyGroups = useMemo(() => {
    const map = new Map<string, SetLite[]>();
    for (const s of allSets) {
      const mk = s.launch_date ? s.launch_date.slice(0, 7) : "Unknown";
      if (!map.has(mk)) map.set(mk, []);
      map.get(mk)!.push(s);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === "Unknown") return 1;
      if (b[0] === "Unknown") return -1;
      return b[0].localeCompare(a[0]); // newest first
    });
  }, [allSets]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* Header */}
      <section className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">New LEGO releases</h1>
        <p className="mt-2 max-w-[640px] text-sm text-zinc-500">
          Browse the latest LEGO sets, organized by release month.
        </p>

        {initialError ? (
          <p className="mt-4 text-sm text-red-600">Error loading sets: {initialError}</p>
        ) : null}
      </section>

      {!initialError && allSets.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No sets found.</p>
      ) : null}

      {!initialError && allSets.length > 0 ? (
        <>
          {/* 1. Spotlight */}
          {heroSet ? <HeroSpotlight set={heroSet} /> : null}

          {/* 2. Stats blocks */}
          <StatsBar sets={allSets} />

          {/* 3. Featured themes */}
          <FeaturedThemesSection
            themes={featuredThemes}
            sets={allSets}
            owned={ownedSetNums}
            wish={wishlistSetNums}
            token={token ?? null}
            getUserRating={getUserRating}
          />

          <AdSlot slot="new_mid" format="horizontal" className="mt-8" />

          {/* 4. All releases by month */}
          <section className="mt-12">
            <h2 className="m-0 text-lg font-semibold text-zinc-900">All new releases by month</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {allSets.length} {allSets.length === 1 ? "set" : "sets"} across{" "}
              {monthlyGroups.length} {monthlyGroups.length === 1 ? "month" : "months"}
            </p>

            <div className="mt-6 space-y-12">
              {monthlyGroups.map(([mk, monthSets]) => (
                <MonthlyReleaseSection
                  key={mk}
                  monthKey={mk}
                  sets={monthSets}
                  owned={ownedSetNums}
                  wish={wishlistSetNums}
                  token={token ?? null}
                  getUserRating={getUserRating}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
