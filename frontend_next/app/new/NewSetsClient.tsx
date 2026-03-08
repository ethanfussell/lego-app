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

/** Format a "YYYY-MM" key into "March 2026" style. */
function formatMonthKey(ym: string): string {
  if (ym === "Unknown") return ym;
  try {
    // ym is "YYYY-MM", e.g. "2026-03"
    const [y, m] = ym.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return ym;
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
// Stats Bar
// ---------------------------------------------------------------------------

function StatsBar({ sets }: { sets: SetLite[] }) {
  // Filter to current month only
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthSets = useMemo(
    () => sets.filter((s) => typeof s.launch_date === "string" && s.launch_date.startsWith(currentMonth)),
    [sets, currentMonth],
  );

  const themeCount = useMemo(() => {
    const uniq = new Set(monthSets.map((s) => (typeof s.theme === "string" ? s.theme.trim() : "")).filter(Boolean));
    return uniq.size;
  }, [monthSets]);

  const largest = useMemo(() => {
    let best: SetLite | null = null;
    for (const s of monthSets) {
      const p = typeof s.pieces === "number" ? s.pieces : 0;
      if (!best || p > (best.pieces ?? 0)) best = s;
    }
    return best;
  }, [monthSets]);

  const totalPieces = useMemo(() => {
    return monthSets.reduce((acc, s) => acc + (typeof s.pieces === "number" ? s.pieces : 0), 0);
  }, [monthSets]);

  const largestImg = largest ? (isSafeNextImageSrc(largest.image_url) ? largest.image_url!.trim() : null) : null;

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto]">

      {/* LEFT — Largest set feature card */}
      <div className="col-span-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:col-span-1">
        {largest ? (
          <Link
            href={`/sets/${encodeURIComponent(largest.set_num)}`}
            className="group flex h-full items-center gap-5 p-4"
          >
            {/* Image */}
            <div className="relative h-28 w-28 shrink-0 rounded-xl bg-white sm:h-32 sm:w-32">
              {largestImg ? (
                <Image
                  src={largestImg}
                  alt={largest.name || "Largest set"}
                  fill
                  sizes="128px"
                  className="object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-zinc-50 text-xs text-zinc-400">
                  No image
                </div>
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                Largest set this month
              </div>
              <div className="mt-1.5 text-lg font-bold leading-snug text-zinc-900 group-hover:text-amber-600 transition-colors sm:text-xl">
                {largest.name}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                <span className="font-semibold text-zinc-900">{largest.pieces?.toLocaleString()} pieces</span>
                {largest.theme ? <span>{largest.theme}</span> : null}
                {typeof largest.retail_price === "number" && (
                  <span className="font-semibold text-zinc-900">{formatPrice(largest.retail_price, "USD")}</span>
                )}
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex h-full items-center justify-center px-5 py-10">
            <div className="text-sm text-zinc-400">No sets this month</div>
          </div>
        )}
      </div>

      {/* RIGHT — Three stat tiles stacked in a column */}
      <div className="col-span-2 grid grid-cols-3 gap-3 sm:col-span-1 sm:w-64 sm:grid-cols-1">
        {/* Sets count */}
        <div className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tracking-tight text-zinc-900">{monthSets.length}</span>
            <span className="text-sm font-medium text-zinc-400">sets</span>
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-zinc-500">Released this month</div>
        </div>

        {/* Themes count */}
        <div className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tracking-tight text-zinc-900">{themeCount}</span>
            <span className="text-sm font-medium text-zinc-400">themes</span>
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-zinc-500">Across this month</div>
        </div>

        {/* Total pieces */}
        <div className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 shadow-sm">
          <div className="text-2xl font-extrabold tracking-tight text-zinc-900">
            {totalPieces.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-zinc-500">Total pieces</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme Filter Pills
// ---------------------------------------------------------------------------

function ThemePills({
  themes,
  active,
  onChange,
}: {
  themes: string[];
  active: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto pb-1">
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
          All
        </button>
        {themes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              active === t
                ? "border-amber-500 bg-amber-500 text-black"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wave Section (month group)
// ---------------------------------------------------------------------------

function WaveSection({
  dateStr,
  sets,
  owned,
  wish,
  token,
}: {
  dateStr: string;
  sets: SetLite[];
  owned: Set<string>;
  wish: Set<string>;
  token: string | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 px-1 pb-5">
        <h3 className="m-0 text-xl font-bold text-zinc-900">{formatMonthKey(dateStr)}</h3>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">
          {sets.length} {sets.length === 1 ? "set" : "sets"}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
        {sets.map((s) => {
          const sn = String(s.set_num || "").trim();
          if (!sn) return null;

          const isOwned = owned.has(sn);
          const isWish = wish.has(sn);

          const footer = token ? (
            <SetCardActions token={token} setNum={sn} isOwned={isOwned} isWishlist={isWish} />
          ) : null;

          return (
            <div key={sn} className="w-[220px]">
              <SetCard set={toSetCardSet(s)} footer={footer} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carousel Row (for Featured Themes)
// ---------------------------------------------------------------------------

function CarouselRow({
  title,
  subtitle,
  sets,
  owned,
  wish,
  token,
}: {
  title: string;
  subtitle?: string;
  sets: SetLite[];
  owned: Set<string>;
  wish: Set<string>;
  token: string | null;
}) {
  if (!sets.length) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-semibold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2">
        <ul className="m-0 flex list-none gap-3 p-0">
          {sets.map((s) => {
            const sn = String(s.set_num || "").trim();
            if (!sn) return null;

            const isOwned = owned.has(sn);
            const isWish = wish.has(sn);

            const footer = token ? (
              <SetCardActions token={token} setNum={sn} isOwned={isOwned} isWishlist={isWish} />
            ) : null;

            return (
              <li key={sn} className="w-[220px] shrink-0">
                <SetCard set={toSetCardSet(s)} footer={footer} />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Featured Themes
// ---------------------------------------------------------------------------

function FeaturedThemes({
  sets,
  owned,
  wish,
  token,
  featuredThemes,
}: {
  sets: SetLite[];
  owned: Set<string>;
  wish: Set<string>;
  token: string | null;
  featuredThemes: string[];
}) {
  const themes = (featuredThemes || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!themes.length) return null;

  const byTheme = useMemo(() => {
    const map = new Map<string, SetLite[]>();
    for (const theme of themes) map.set(theme, []);

    for (const s of sets) {
      const t = typeof s.theme === "string" ? s.theme.trim() : "";
      if (!t) continue;
      if (!map.has(t)) continue;
      map.get(t)!.push(s);
    }

    for (const [k, arr] of map.entries()) {
      map.set(k, arr.slice(0, 14));
    }

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, themes.join("|")]);

  const any = themes.some((t) => (byTheme.get(t)?.length ?? 0) > 0);
  if (!any) return null;

  return (
    <section className="mt-10">
      <h2 className="m-0 text-base font-semibold text-zinc-900">Featured themes</h2>
      <p className="mt-2 text-sm text-zinc-500">Highlighted themes from recent releases.</p>

      {themes.map((theme) => {
        const themeSets = byTheme.get(theme) ?? [];
        return (
          <CarouselRow
            key={theme}
            title={theme}
            subtitle={themeSets.length ? `${themeSets.length} set${themeSets.length === 1 ? "" : "s"}` : undefined}
            sets={themeSets}
            owned={owned}
            wish={wish}
            token={token}
          />
        );
      })}
    </section>
  );
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
  const { ownedSetNums, wishlistSetNums } = useCollectionStatus();

  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  const allSets = useMemo(() => (Array.isArray(initialSets) ? initialSets : []), [initialSets]);

  // Hero: admin-pinned set, or biggest set from the most recent launch date
  const heroSet = useMemo(() => {
    if (!allSets.length) return null;

    // Admin-pinned spotlight takes priority
    if (spotlightSetNum) {
      const pinned = allSets.find((s) => s.set_num === spotlightSetNum);
      if (pinned) return pinned;
    }

    // Auto-pick: biggest set from the most recent launch date
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

  // Filter by theme
  const filteredSets = useMemo(() => {
    if (!activeTheme) return allSets;
    return allSets.filter((s) => s.theme === activeTheme);
  }, [allSets, activeTheme]);

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

  // Group by launch month for wave sections (capped to 12 most recent months)
  const waves = useMemo(() => {
    const map = new Map<string, SetLite[]>();
    for (const s of filteredSets) {
      const d = s.launch_date ? s.launch_date.slice(0, 7) : "Unknown"; // "YYYY-MM"
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(s);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12); // rolling 12-month window
  }, [filteredSets]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* Header */}
      <section className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">New LEGO releases</h1>
        <p className="mt-2 max-w-[640px] text-sm text-zinc-500">
          The latest sets sorted by official launch date.
        </p>

        {initialError ? <p className="mt-4 text-sm text-red-600">Error loading sets: {initialError}</p> : null}

        {/* Collection status loaded via useCollectionStatus hook */}
      </section>

      {!initialError && allSets.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No sets found.</p>
      ) : null}

      {/* Hero Spotlight */}
      {heroSet ? <HeroSpotlight set={heroSet} /> : null}

      {/* Stats */}
      <StatsBar sets={allSets} />

      {/* Featured Theme Carousels */}
      <FeaturedThemes
        sets={allSets}
        owned={ownedSetNums}
        wish={wishlistSetNums}
        token={token ?? null}
        featuredThemes={featuredThemes}
      />

      {/* Browse Section */}
      <section className="mt-14">
        <h2 className="m-0 text-lg font-semibold text-zinc-900">Browse releases</h2>

        <ThemePills themes={topThemes} active={activeTheme} onChange={setActiveTheme} />

        {/* Result count */}
        {(() => {
          const visibleCount = waves.reduce((sum, [, s]) => sum + s.length, 0);
          return (
            <div className="mt-4 text-sm text-zinc-500">
              {visibleCount} {visibleCount === 1 ? "set" : "sets"}
              {activeTheme ? ` in ${activeTheme}` : ""}
            </div>
          );
        })()}

        {/* Wave-grouped sets */}
        <div className="mt-4 space-y-10">
          {waves.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-400">No sets match your filters.</div>
          ) : (
            waves.map(([dateStr, waveSets]) => (
              <WaveSection
                key={dateStr}
                dateStr={dateStr}
                sets={waveSets}
                owned={ownedSetNums}
                wish={wishlistSetNums}
                token={token ?? null}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
