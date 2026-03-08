// frontend_next/app/discover/DiscoverHub.tsx
"use client";

import React, { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import SetCard, { type SetLite } from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import { formatPrice } from "@/lib/format";
import { safeImageSrc } from "@/lib/image";
import { FEATURED_LISTS } from "@/lib/featuredLists";
import type { DiscoverData, SectionConfig } from "./page";

/* ═══════════════════════════════════════════════════════════════
   SHARED HELPERS
   ═══════════════════════════════════════════════════════════════ */

type PublicList = DiscoverData["lists"][number];

function listTitle(l: PublicList): string {
  const t = ((l.title ?? l.name ?? "") as string).trim();
  return t || `List #${String(l.id)}`;
}

function listOwner(l: PublicList): string {
  return String(l.owner ?? l.owner_username ?? "").trim();
}

function listCount(l: PublicList): number {
  const n = Number(l.items_count ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════ */

function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel = "See all",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 text-sm font-semibold text-amber-600 hover:text-amber-500 transition-colors"
        >
          {linkLabel} &rarr;
        </Link>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HORIZONTAL SCROLL ROW
   ═══════════════════════════════════════════════════════════════ */

function ScrollRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function scroll(dir: 1 | -1) {
    if (!ref.current) return;
    const amount = Math.max(260, Math.floor(ref.current.clientWidth * 0.85));
    ref.current.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  return (
    <div className={`group/scroll relative ${className}`}>
      {/* Left arrow */}
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-white/90 p-1.5 text-zinc-400 shadow-sm backdrop-blur hover:bg-white hover:text-zinc-700 sm:group-hover/scroll:block transition-colors"
        aria-label="Scroll left"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Right arrow */}
      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-white/90 p-1.5 text-zinc-400 shadow-sm backdrop-blur hover:bg-white hover:text-zinc-700 sm:group-hover/scroll:block transition-colors"
        aria-label="Scroll right"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div
        ref={ref}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:-mx-0 sm:px-0"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SET ROW (reusable for any horizontal set list)
   ═══════════════════════════════════════════════════════════════ */

function SetRow({
  sets,
  token,
  isOwned,
  isWishlist,
  badge,
}: {
  sets: SetLite[];
  token: string | null;
  isOwned: (s: string) => boolean;
  isWishlist: (s: string) => boolean;
  badge?: (set: SetLite) => React.ReactNode;
}) {
  if (sets.length === 0) return null;

  return (
    <ScrollRow>
      {sets.map((s) => (
        <div key={s.set_num} className="w-[200px] shrink-0 snap-start sm:w-[220px]">
          {badge && <div className="mb-1">{badge(s)}</div>}
          <SetCard
            set={s}
            footer={
              token ? (
                <SetCardActions
                  token={token}
                  setNum={s.set_num}
                  isOwned={isOwned(s.set_num)}
                  isWishlist={isWishlist(s.set_num)}
                />
              ) : undefined
            }
          />
        </div>
      ))}
    </ScrollRow>
  );
}

/* ═══════════════════════════════════════════════════════════════
   1. HERO SPOTLIGHT
   ═══════════════════════════════════════════════════════════════ */

function HeroSpotlight({ set, newCount, retiringCount }: { set: SetLite | null; newCount: number; retiringCount: number }) {
  if (!set) {
    // Fallback hero when no spotlight set configured
    return (
      <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-8 sm:p-10">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Discover</span>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            Your LEGO discovery hub
          </h1>
          <p className="mt-1 max-w-lg text-base text-zinc-500">
            New releases, retiring sets, deals, top-rated builds, community lists, and more — all in one place.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {newCount > 0 && (
              <Link href="/new" className="rounded-full bg-green-100 px-3.5 py-1.5 font-semibold text-green-800 hover:bg-green-200 transition-colors">
                {newCount} New releases
              </Link>
            )}
            {retiringCount > 0 && (
              <Link href="/retiring-soon" className="rounded-full bg-red-100 px-3.5 py-1.5 font-semibold text-red-800 hover:bg-red-200 transition-colors">
                {retiringCount} Retiring soon
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  const imgSrc = safeImageSrc(set.image_url);
  const title = set.name || set.set_num;

  return (
    <Link
      href={`/sets/${encodeURIComponent(set.set_num)}`}
      className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 transition-shadow hover:shadow-lg"
    >
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        {/* Image */}
        {imgSrc && (
          <div className="relative mx-auto aspect-square w-full max-w-[220px] shrink-0 sm:mx-0 sm:w-[200px]">
            <Image
              src={imgSrc}
              alt={title}
              fill
              sizes="220px"
              className="object-contain drop-shadow-md"
              priority
            />
          </div>
        )}

        {/* Info */}
        <div className="flex-1">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
            Spotlight
          </span>
          <h1 className="mt-2 text-2xl font-extrabold text-zinc-900 group-hover:text-amber-700 transition-colors sm:text-3xl">
            {title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            {set.year && <span>{set.year}</span>}
            {set.pieces && (
              <>
                <span aria-hidden>·</span>
                <span>{set.pieces.toLocaleString()} pieces</span>
              </>
            )}
            {set.theme && (
              <>
                <span aria-hidden>·</span>
                <span>{set.theme}</span>
              </>
            )}
          </div>
          {(set.retail_price || set.sale_price) && (
            <div className="mt-3 flex items-baseline gap-2">
              {typeof set.sale_price === "number" && typeof set.retail_price === "number" && set.sale_price < set.retail_price ? (
                <>
                  <span className="text-xl font-bold text-green-700">{formatPrice(set.sale_price)}</span>
                  <span className="text-sm text-zinc-400 line-through">{formatPrice(set.retail_price)}</span>
                </>
              ) : (
                <span className="text-xl font-bold text-zinc-900">{formatPrice(set.retail_price)}</span>
              )}
            </div>
          )}
          <div className="mt-4 inline-flex items-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white group-hover:bg-amber-600 transition-colors">
            View set &rarr;
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. RETIRING SOON — with urgency badges
   ═══════════════════════════════════════════════════════════════ */

function retirementBadge(set: SetLite): React.ReactNode {
  if (!set.retirement_date) return null;
  // retirement_date is typically "YYYY-MM" or a date string
  const now = new Date();
  const retDate = new Date(set.retirement_date + (set.retirement_date.length <= 7 ? "-01" : ""));
  const diffMs = retDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
        Last chance
      </span>
    );
  }
  if (diffDays <= 90) {
    return (
      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
        Retiring soon
      </span>
    );
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   3. BROWSE BY THEME
   ═══════════════════════════════════════════════════════════════ */

// Assign each theme a unique warm color from a palette
const THEME_COLORS = [
  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", hover: "hover:bg-amber-100" },
  { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", hover: "hover:bg-blue-100" },
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", hover: "hover:bg-emerald-100" },
  { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800", hover: "hover:bg-purple-100" },
  { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-800", hover: "hover:bg-rose-100" },
  { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800", hover: "hover:bg-sky-100" },
  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800", hover: "hover:bg-orange-100" },
  { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-800", hover: "hover:bg-teal-100" },
  { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-800", hover: "hover:bg-pink-100" },
  { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-800", hover: "hover:bg-indigo-100" },
];

function ThemeGrid({ themes, limit = 12 }: { themes: DiscoverData["themes"]; limit?: number }) {
  if (themes.length === 0) return null;

  const sorted = [...themes]
    .filter((t) => (t.set_count ?? 0) > 0)
    .sort((a, b) => (b.set_count ?? 0) - (a.set_count ?? 0))
    .slice(0, limit);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {sorted.map((t, i) => {
        const c = THEME_COLORS[i % THEME_COLORS.length];
        const slug = encodeURIComponent(t.theme);
        return (
          <Link
            key={t.theme}
            href={`/themes/${slug}`}
            className={`group rounded-xl border ${c.border} ${c.bg} ${c.hover} p-3 text-center transition-colors`}
          >
            <div className={`text-sm font-bold ${c.text}`}>{t.theme}</div>
            {typeof t.set_count === "number" && (
              <div className="mt-0.5 text-xs text-zinc-400">
                {t.set_count.toLocaleString()} sets
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. FEATURED LISTS
   ═══════════════════════════════════════════════════════════════ */

function FeaturedListsSection({ lists, limit = 6 }: { lists: PublicList[]; limit?: number }) {
  // Merge FEATURED_LISTS config with actual data
  const byId = new Map<string, PublicList>();
  for (const l of lists) byId.set(String(l.id), l);

  const featured = FEATURED_LISTS.map((f) => {
    const real = byId.get(String(f.id));
    if (real) return { ...real, title: f.title ?? real.title ?? real.name } as PublicList;
    return null;
  }).filter((l): l is PublicList => l !== null);

  // Also show other popular public lists (not in featured)
  const featuredIds = new Set(FEATURED_LISTS.map((f) => String(f.id)));
  const otherLists = lists
    .filter((l) => !featuredIds.has(String(l.id)))
    .sort((a, b) => listCount(b) - listCount(a))
    .slice(0, 3);

  const allLists = [...featured, ...otherLists].slice(0, limit);

  if (allLists.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {allLists.map((l) => {
        const id = String(l.id);
        const title = listTitle(l);
        const owner = listOwner(l);
        const count = listCount(l);
        const desc = ((l.description ?? "") as string).trim();
        const isFeatured = featuredIds.has(id);

        return (
          <Link
            key={id}
            href={`/lists/${encodeURIComponent(id)}`}
            className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-amber-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 font-semibold text-zinc-900 group-hover:text-amber-700 transition-colors">
                {title}
              </div>
              {isFeatured && (
                <span className="shrink-0 inline-flex items-center rounded-full border border-amber-400/30 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  Featured
                </span>
              )}
            </div>

            {desc && (
              <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{desc}</p>
            )}

            <div className="mt-auto pt-3 flex items-center gap-2 text-xs text-zinc-400">
              {count > 0 && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                  {count} set{count === 1 ? "" : "s"}
                </span>
              )}
              {owner && <span>by {owner}</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. QUICK FILTERS / DISCOVERY CARDS
   ═══════════════════════════════════════════════════════════════ */

const DISCOVERY_CARDS = [
  {
    label: "Under $30",
    href: "/search?max_price=30",
    icon: "💰",
    color: "from-green-50 to-emerald-50 border-green-200 hover:border-green-300",
  },
  {
    label: "500+ Pieces",
    href: "/search?min_pieces=500",
    icon: "🧱",
    color: "from-blue-50 to-sky-50 border-blue-200 hover:border-blue-300",
  },
  {
    label: "Top Rated",
    href: "/search?sort=rating&order=desc",
    icon: "⭐",
    color: "from-amber-50 to-yellow-50 border-amber-200 hover:border-amber-300",
  },
  {
    label: "Display Sets",
    href: "/themes/Icons",
    icon: "🏛️",
    color: "from-purple-50 to-violet-50 border-purple-200 hover:border-purple-300",
  },
  {
    label: "For Kids",
    href: "/themes/City",
    icon: "👦",
    color: "from-orange-50 to-red-50 border-orange-200 hover:border-orange-300",
  },
  {
    label: "Most Pieces",
    href: "/pieces/most",
    icon: "🏗️",
    color: "from-teal-50 to-cyan-50 border-teal-200 hover:border-teal-300",
  },
];

function DiscoveryCards() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
      {DISCOVERY_CARDS.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className={`group flex flex-col items-center gap-1.5 rounded-xl border bg-gradient-to-br ${card.color} p-4 text-center transition-all hover:shadow-md`}
        >
          <span className="text-2xl">{card.icon}</span>
          <span className="text-sm font-bold text-zinc-800">{card.label}</span>
        </Link>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. FRIENDS ACTIVITY (placeholder)
   ═══════════════════════════════════════════════════════════════ */

function FriendsActivityPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
        <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      </div>
      <h3 className="font-semibold text-zinc-700">Friends &amp; Activity</h3>
      <p className="mt-1 text-sm text-zinc-400">
        See what your friends are collecting and reviewing. Coming soon!
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   7. ARTICLES / GUIDES (placeholder)
   ═══════════════════════════════════════════════════════════════ */

const PLACEHOLDER_GUIDES = [
  {
    title: "Best Star Wars Sets of 2026",
    desc: "Our top picks from the latest wave of Star Wars LEGO sets.",
    tag: "Guide",
  },
  {
    title: "Sets Under $50 Worth Buying",
    desc: "Great builds that won't break the bank.",
    tag: "Budget",
  },
  {
    title: "Building Your First Display Shelf",
    desc: "Tips for showcasing your LEGO collection at home.",
    tag: "Tips",
  },
];

function ArticlesPlaceholder() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PLACEHOLDER_GUIDES.map((g) => (
        <div
          key={g.title}
          className="group rounded-xl border border-zinc-200 bg-white p-5 opacity-75"
        >
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            {g.tag} · Coming soon
          </span>
          <div className="mt-2 font-semibold text-zinc-700">{g.title}</div>
          <p className="mt-1 text-sm text-zinc-400">{g.desc}</p>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   8. COMING SOON SECTION
   ═══════════════════════════════════════════════════════════════ */

function comingSoonBadge(set: SetLite): React.ReactNode {
  if (!set.launch_date) return null;
  const launch = new Date(set.launch_date);
  const now = new Date();
  const diffMs = launch.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 7 && diffDays > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
        This week
      </span>
    );
  }
  if (diffDays <= 30 && diffDays > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
        This month
      </span>
    );
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function DiscoverHub({ data }: { data: DiscoverData }) {
  const { token } = useAuth();
  const { isOwned, isWishlist } = useCollectionStatus();

  const { newReleases, retiringSoon, comingSoon, topRated, popular, themes, lists, spotlight, hiddenSections, sectionConfig } = data;
  const hidden = new Set(hiddenSections);
  const cfg = (id: string) => sectionConfig[id] || {};

  // Filter sale sets — ones where sale_price < retail_price
  const saleSets = popular.filter(
    (s) =>
      typeof s.sale_price === "number" &&
      typeof s.retail_price === "number" &&
      s.sale_price < s.retail_price,
  );

  // Apply min_rating filter for top rated
  const minRating = cfg("top_rated").min_rating ?? 4.0;
  const filteredTopRated = topRated.filter((s) => {
    const r = s.rating_avg ?? s.average_rating;
    return typeof r === "number" ? r >= minRating : true;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      {/* ─── 1. Hero Spotlight ──────────────────────────────── */}
      <section className="mt-6">
        <HeroSpotlight
          set={spotlight}
          newCount={newReleases.length}
          retiringCount={retiringSoon.length}
        />
      </section>

      {/* ─── Quick Filters ──────────────────────────────────── */}
      {!hidden.has("quick_explore") && (
        <section className="mt-8">
          <SectionHeader title={cfg("quick_explore").title || "Quick explore"} />
          <DiscoveryCards />
        </section>
      )}

      {/* ─── 2. New Releases ────────────────────────────────── */}
      {!hidden.has("new_releases") && newReleases.length > 0 && (
        <section className="mt-10">
          <SectionHeader
            title={cfg("new_releases").title || "New Releases"}
            subtitle={cfg("new_releases").subtitle || "Recently launched sets"}
            href="/new"
          />
          <SetRow sets={newReleases.slice(0, cfg("new_releases").limit ?? 14)} token={token} isOwned={isOwned} isWishlist={isWishlist} />
        </section>
      )}

      {/* ─── 3. Retiring Soon ───────────────────────────────── */}
      {!hidden.has("retiring_soon") && retiringSoon.length > 0 && (
        <section className="mt-10">
          <SectionHeader
            title={cfg("retiring_soon").title || "Retiring Soon"}
            subtitle={cfg("retiring_soon").subtitle || "Get them before they're gone"}
            href="/retiring-soon"
          />
          <SetRow
            sets={retiringSoon.slice(0, cfg("retiring_soon").limit ?? 14)}
            token={token}
            isOwned={isOwned}
            isWishlist={isWishlist}
            badge={retirementBadge}
          />
        </section>
      )}

      {/* ─── 4. Best Deals ──────────────────────────────────── */}
      {!hidden.has("best_deals") && saleSets.length > 0 && (
        <section className="mt-10">
          <SectionHeader
            title={cfg("best_deals").title || "Best Deals"}
            subtitle={cfg("best_deals").subtitle || "Sets with price drops"}
            href="/sale"
          />
          <SetRow sets={saleSets} token={token} isOwned={isOwned} isWishlist={isWishlist} />
        </section>
      )}

      {/* ─── 5. Coming Soon ─────────────────────────────────── */}
      {!hidden.has("coming_soon") && comingSoon.length > 0 && (
        <section className="mt-10">
          <SectionHeader
            title={cfg("coming_soon").title || "Coming Soon"}
            subtitle={cfg("coming_soon").subtitle || "Upcoming releases"}
          />
          <SetRow
            sets={comingSoon.slice(0, cfg("coming_soon").limit ?? 14)}
            token={token}
            isOwned={isOwned}
            isWishlist={isWishlist}
            badge={comingSoonBadge}
          />
        </section>
      )}

      {/* ─── 6. Browse by Theme ─────────────────────────────── */}
      {!hidden.has("browse_by_theme") && themes.length > 0 && (
        <section className="mt-10">
          <SectionHeader
            title={cfg("browse_by_theme").title || "Browse by Theme"}
            subtitle={cfg("browse_by_theme").subtitle || "Explore your favorite worlds"}
            href="/themes"
          />
          <ThemeGrid themes={themes} limit={cfg("browse_by_theme").limit ?? 12} />
        </section>
      )}

      {/* ─── 7. Top Rated ───────────────────────────────────── */}
      {!hidden.has("top_rated") && filteredTopRated.length > 0 && (
        <section className="mt-10">
          <SectionHeader
            title={cfg("top_rated").title || "Top Rated by Community"}
            subtitle={cfg("top_rated").subtitle || "Highest-rated sets"}
            href="/search?sort=rating&order=desc"
            linkLabel="Browse top rated"
          />
          <SetRow sets={filteredTopRated.slice(0, cfg("top_rated").limit ?? 14)} token={token} isOwned={isOwned} isWishlist={isWishlist} />
        </section>
      )}

      {/* ─── 8. Featured Lists ──────────────────────────────── */}
      {!hidden.has("featured_lists") && lists.length > 0 && (
        <section className="mt-10">
          <SectionHeader
            title={cfg("featured_lists").title || "Featured Lists"}
            subtitle={cfg("featured_lists").subtitle || "Curated by the community"}
            href="/discover/lists"
            linkLabel="Browse all lists"
          />
          <FeaturedListsSection lists={lists} limit={cfg("featured_lists").limit ?? 6} />
        </section>
      )}

      {/* ─── 9. Friends & Activity ──────────────────────────── */}
      {!hidden.has("social") && (
        <section className="mt-10">
          <SectionHeader title={cfg("social").title || "Social"} />
          <FriendsActivityPlaceholder />
        </section>
      )}

      {/* ─── 10. Articles & Guides ──────────────────────────── */}
      {!hidden.has("guides") && (
        <section className="mt-10">
          <SectionHeader title={cfg("guides").title || "Guides & Articles"} />
          <ArticlesPlaceholder />
        </section>
      )}
    </div>
  );
}
