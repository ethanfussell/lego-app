// frontend_next/app/retiring-soon/RetiringSoonClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import { formatPrice } from "@/lib/format";
import type { SetLite } from "@/lib/types";
import AdSlot from "@/app/components/AdSlot";

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

function getRetireDate(s: SetLite): string | null {
  return s.exit_date ?? s.retirement_date ?? null;
}

function parseRetireDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  try {
    const d = new Date(raw + "T00:00:00");
    return Number.isFinite(d.getTime()) ? d : null;
  } catch {
    return null;
  }
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

function daysUntil(dateStr: string | null | undefined): number | null {
  const d = parseRetireDate(dateStr);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

type UrgencyLevel = "critical" | "soon" | "later" | "unknown";

function getUrgency(dateStr: string | null | undefined): UrgencyLevel {
  const days = daysUntil(dateStr);
  if (days === null) return "unknown";
  if (days <= 30) return "critical";
  if (days <= 90) return "soon";
  return "later";
}

const urgencyConfig: Record<UrgencyLevel, { label: string; bg: string; text: string; dot: string }> = {
  critical: { label: "Retiring very soon", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  soon: { label: "Retiring soon", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  later: { label: "Later this year", bg: "bg-zinc-50", text: "text-zinc-600", dot: "bg-zinc-400" },
  unknown: { label: "Date TBD", bg: "bg-zinc-50", text: "text-zinc-500", dot: "bg-zinc-300" },
};

function getPieces(s: SetLite): number {
  return typeof s.pieces === "number" ? s.pieces : typeof s.num_parts === "number" ? s.num_parts : 0;
}

// ---------------------------------------------------------------------------
// Urgency Badge
// ---------------------------------------------------------------------------

function UrgencyBadge({ dateStr }: { dateStr: string | null | undefined }) {
  const days = daysUntil(dateStr);
  const urgency = getUrgency(dateStr);
  const cfg = urgencyConfig[urgency];

  if (urgency === "unknown" || urgency === "later") return null;

  const label = days !== null && days <= 0
    ? "Retired"
    : days !== null && days <= 7
      ? `${days} day${days === 1 ? "" : "s"} left`
      : days !== null && days <= 60
        ? `${days} days left`
        : null;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {label ?? cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stats Bar
// ---------------------------------------------------------------------------

function StatsBar({ sets }: { sets: SetLite[] }) {
  const julyCount = useMemo(
    () => sets.filter((s) => (getRetireDate(s) || "").startsWith("2026-07")).length,
    [sets],
  );

  const decCount = useMemo(
    () => sets.filter((s) => (getRetireDate(s) || "").startsWith("2026-12")).length,
    [sets],
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

  const biggestPieces = biggestSet ? getPieces(biggestSet) : 0;
  const biggestImg = biggestSet && isSafeNextImageSrc(biggestSet.image_url) ? biggestSet.image_url!.trim() : null;
  const biggestPrice = biggestSet && typeof biggestSet.retail_price === "number" ? biggestSet.retail_price : null;

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* July 2026 */}
      <div className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-2xl font-extrabold tracking-tight text-zinc-900">{julyCount}</span>
        <div className="mt-0.5 text-[11px] font-medium text-zinc-500">Retiring July 2026</div>
      </div>

      {/* December 2026 */}
      <div className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-2xl font-extrabold tracking-tight text-zinc-900">{decCount}</span>
        <div className="mt-0.5 text-[11px] font-medium text-zinc-500">Retiring Dec 2026</div>
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
            <div className="text-[11px] font-medium text-zinc-500">Most pieces retiring</div>
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
  { value: "name-asc", label: "A–Z" },
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
// Retirement Window Section (grouped by month, with its own sort)
// ---------------------------------------------------------------------------

function RetirementWindowSection({
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

  const urgency = useMemo(() => {
    const urgencies = sets.map((s) => getUrgency(getRetireDate(s)));
    if (urgencies.includes("critical")) return "critical";
    if (urgencies.includes("soon")) return "soon";
    return "later";
  }, [sets]);

  const cfg = urgencyConfig[urgency];

  const sorted = useMemo(() => sortSets(sets, sectionSort), [sets, sectionSort]);

  return (
    <div>
      <div className="flex flex-col gap-2 px-1 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="m-0 text-xl font-bold text-zinc-900">{formatMonthYear(monthKey)}</h3>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
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
          const retireDate = getRetireDate(s);

          const footer = (
            <div className="space-y-2">
              <UrgencyBadge dateStr={retireDate} />
              {token ? (
                <SetCardActions token={token} setNum={sn} isOwned={isOwn} isWishlist={isWish} />
              ) : null}
            </div>
          );

          return (
            <div key={sn} className="w-[220px]">
              <SetCard set={toSetCardSet(s)} token={token ?? undefined} isOwnedByUser={isOwn} userRatingOverride={getUserRating(sn)} footer={footer} />
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

export default function RetiringSoonClient({
  initialSets,
  initialError,
}: {
  initialSets: SetLite[];
  initialError: string | null;
}) {
  const { token } = useAuth();
  const { ownedSetNums, wishlistSetNums, getUserRating } = useCollectionStatus();
  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  const allSets = useMemo(() => (Array.isArray(initialSets) ? initialSets : []), [initialSets]);

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

  // Group by retirement month
  const retirementWindows = useMemo(() => {
    const map = new Map<string, SetLite[]>();
    for (const s of filteredSets) {
      const retireDate = getRetireDate(s);
      const monthKey = retireDate ? retireDate.slice(0, 7) : "Unknown";
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(s);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === "Unknown") return 1;
      if (b[0] === "Unknown") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredSets]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* Header */}
      <section className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">Retiring soon</h1>
        <p className="mt-2 max-w-[640px] text-sm text-zinc-500">
          These LEGO sets are expected to retire soon. Once they&apos;re gone, prices typically rise on the secondary market. Grab your favorites before it&apos;s too late.
        </p>

        {initialError ? <p className="mt-4 text-sm text-red-600">Error: {initialError}</p> : null}
      </section>

      {!initialError && allSets.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No sets marked as retiring soon right now.</p>
      ) : null}

      {!initialError && allSets.length > 0 ? (
        <>
          {/* Stats */}
          <StatsBar sets={allSets} />

          <AdSlot slot="retiring_mid" format="horizontal" className="mt-8" />

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

            {/* Retirement windows with per-section sort */}
            <div className="mt-6 space-y-12">
              {retirementWindows.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400">No sets match your filters.</div>
              ) : (
                retirementWindows.map(([monthKey, windowSets]) => (
                  <RetirementWindowSection
                    key={monthKey}
                    monthKey={monthKey}
                    sets={windowSets}
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
