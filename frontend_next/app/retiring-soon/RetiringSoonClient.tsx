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
    const d = new Date(Number(y), Number(m) - 1, 1);
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

// ---------------------------------------------------------------------------
// Urgency Badge
// ---------------------------------------------------------------------------

function UrgencyBadge({ dateStr }: { dateStr: string | null | undefined }) {
  const days = daysUntil(dateStr);
  const urgency = getUrgency(dateStr);
  const cfg = urgencyConfig[urgency];

  if (urgency === "unknown") return null;

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
// Hero Spotlight — most valuable retiring set
// ---------------------------------------------------------------------------

function HeroSpotlight({ set }: { set: SetLite }) {
  const sn = String(set.set_num || "").trim();
  const imgSrc = isSafeNextImageSrc(set.image_url) ? set.image_url!.trim() : null;
  const pieces = typeof set.pieces === "number" ? set.pieces : typeof set.num_parts === "number" ? set.num_parts : null;
  const price = typeof set.retail_price === "number" ? set.retail_price : null;
  const retireDate = getRetireDate(set);

  return (
    <Link
      href={`/sets/${sn}`}
      prefetch={false}
      className="mt-6 flex flex-col overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/60 to-white shadow-sm transition-colors hover:border-red-200 sm:flex-row"
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-600">Don&apos;t miss</span>
          <UrgencyBadge dateStr={retireDate} />
        </div>
        <h2 className="mt-1.5 text-xl font-semibold text-zinc-900 sm:text-2xl">{set.name}</h2>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
          {set.theme ? <span>{set.theme}</span> : null}
          {pieces ? <span>{pieces.toLocaleString()} pieces</span> : null}
          {price ? <span className="font-semibold text-zinc-900">{formatPrice(price, "USD")}</span> : null}
        </div>

        {retireDate ? (
          <div className="mt-2 text-xs text-zinc-400">
            Expected retirement: {parseRetireDate(retireDate)?.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
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
  const criticalCount = useMemo(() => sets.filter((s) => getUrgency(getRetireDate(s)) === "critical").length, [sets]);

  const themeCount = useMemo(() => {
    const uniq = new Set(sets.map((s) => (typeof s.theme === "string" ? s.theme.trim() : "")).filter(Boolean));
    return uniq.size;
  }, [sets]);

  const totalValue = useMemo(() => {
    return sets.reduce((acc, s) => acc + (typeof s.retail_price === "number" ? s.retail_price : 0), 0);
  }, [sets]);

  const stats = [
    { value: sets.length, label: "sets", sub: "Retiring" },
    { value: criticalCount, label: "urgent", sub: "Within 30 days" },
    { value: themeCount, label: "themes", sub: "Represented" },
    { value: formatPrice(totalValue, "USD") ?? "$0", label: "total value", sub: "At retail", isString: true },
  ];

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tracking-tight text-zinc-900">
              {s.isString ? s.value : typeof s.value === "number" ? s.value.toLocaleString() : s.value}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-zinc-500">{s.sub}</div>
        </div>
      ))}
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
// Retirement Window Section (grouped by month)
// ---------------------------------------------------------------------------

function RetirementWindowSection({
  monthKey,
  sets,
  owned,
  wish,
  token,
}: {
  monthKey: string;
  sets: SetLite[];
  owned: Set<string>;
  wish: Set<string>;
  token: string | null;
}) {
  // Determine overall urgency for header styling
  const urgency = useMemo(() => {
    const urgencies = sets.map((s) => getUrgency(getRetireDate(s)));
    if (urgencies.includes("critical")) return "critical";
    if (urgencies.includes("soon")) return "soon";
    return "later";
  }, [sets]);

  const cfg = urgencyConfig[urgency];

  return (
    <div>
      <div className="flex items-center gap-3 px-1 pb-5">
        <h3 className="m-0 text-xl font-bold text-zinc-900">{formatMonthYear(monthKey)}</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {sets.length} {sets.length === 1 ? "set" : "sets"}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
        {sets.map((s) => {
          const sn = String(s.set_num || "").trim();
          if (!sn) return null;

          const isOwn = owned.has(sn);
          const isWish = !isOwn && wish.has(sn);

          const retireDate = getRetireDate(s);

          const footer = (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <UrgencyBadge dateStr={retireDate} />
              </div>
              {token ? (
                <SetCardActions token={token} setNum={sn} isOwned={isOwn} isWishlist={isWish} />
              ) : null}
            </div>
          );

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
  const { ownedSetNums, wishlistSetNums } = useCollectionStatus();
  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  const allSets = useMemo(() => (Array.isArray(initialSets) ? initialSets : []), [initialSets]);

  // Hero: highest-rated or most expensive set retiring soonest
  const heroSet = useMemo(() => {
    if (!allSets.length) return null;

    // Pick from sets retiring within 60 days, prefer highest piece count (flagship)
    const urgent = allSets.filter((s) => {
      const days = daysUntil(getRetireDate(s));
      return days !== null && days > 0 && days <= 90;
    });

    const pool = urgent.length > 0 ? urgent : allSets;

    let best: SetLite | null = null;
    let bestScore = -1;

    for (const s of pool) {
      const pieces = typeof s.pieces === "number" ? s.pieces : typeof s.num_parts === "number" ? s.num_parts : 0;
      const price = typeof s.retail_price === "number" ? s.retail_price : 0;
      // Score: weighted combo of pieces and price to find flagship sets
      const score = pieces * 0.5 + price * 2;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }

    return best;
  }, [allSets]);

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
    // Sort chronologically (earliest retirement first)
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
          {/* Hero Spotlight */}
          {heroSet ? <HeroSpotlight set={heroSet} /> : null}

          {/* Stats */}
          <StatsBar sets={allSets} />

          {/* Browse Section */}
          <section className="mt-14">
            <h2 className="m-0 text-lg font-semibold text-zinc-900">Browse by theme</h2>

            <ThemePills themes={topThemes} active={activeTheme} onChange={setActiveTheme} />

            {/* Result count */}
            {(() => {
              const visibleCount = retirementWindows.reduce((sum, [, s]) => sum + s.length, 0);
              return (
                <div className="mt-4 text-sm text-zinc-500">
                  {visibleCount} {visibleCount === 1 ? "set" : "sets"}
                  {activeTheme ? ` in ${activeTheme}` : ""}
                </div>
              );
            })()}

            {/* Retirement window-grouped sets */}
            <div className="mt-4 space-y-10">
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
