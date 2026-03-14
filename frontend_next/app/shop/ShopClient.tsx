// frontend_next/app/shop/ShopClient.tsx
"use client";

import React from "react";
import Link from "next/link";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import CarouselRow from "@/app/components/CarouselRow";
import { useAuth } from "@/app/providers";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import type { SetLite } from "@/lib/types";

type Props = {
  newSets: SetLite[];
  saleSets: SetLite[];
  retiringSets: SetLite[];
};

/* ── category button definitions ─────────────────────── */

const categories = [
  {
    label: "New Releases",
    href: "/new",
    description: "Latest LEGO sets",
    enabled: true,
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    label: "On Sale",
    href: "/sale",
    description: "Deals & price drops",
    enabled: true,
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
  {
    label: "Retiring Soon",
    href: "/retiring-soon",
    description: "Get them before they're gone",
    enabled: true,
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Upcoming",
    href: "#",
    description: "Coming soon",
    enabled: false,
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
];

/* ── component ───────────────────────────────────────── */

export default function ShopClient({ newSets, saleSets, retiringSets }: Props) {
  const { token } = useAuth();
  const { isOwned, isWishlist, getUserRating } = useCollectionStatus();

  function renderCards(sets: SetLite[]) {
    return sets.map((s) => (
      <div key={s.set_num} className="w-[220px] shrink-0 snap-start sm:w-[240px]">
        <SetCard
          set={s}
          token={token ?? undefined}
          isOwnedByUser={isOwned(s.set_num)}
          userRatingOverride={getUserRating(s.set_num)}
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
    ));
  }

  return (
    <div className="mt-8 space-y-10">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Shop</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Browse LEGO sets by category.
        </p>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categories.map((cat) =>
          cat.enabled ? (
            <Link
              key={cat.label}
              href={cat.href}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-amber-300 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100">
                {cat.icon}
              </div>
              <span className="text-sm font-semibold text-zinc-900">
                {cat.label}
              </span>
              <span className="text-xs text-zinc-500">{cat.description}</span>
            </Link>
          ) : (
            <div
              key={cat.label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-center opacity-60 cursor-default"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                {cat.icon}
              </div>
              <span className="text-sm font-semibold text-zinc-500">
                {cat.label}
              </span>
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                Coming soon
              </span>
            </div>
          ),
        )}
      </div>

      {/* ── Carousels ────────────────────────────────────── */}

      {newSets.length > 0 && (
        <CarouselRow title="New Releases" viewHref="/new">
          {renderCards(newSets)}
        </CarouselRow>
      )}

      {saleSets.length > 0 && (
        <CarouselRow title="On Sale" viewHref="/sale">
          {renderCards(saleSets)}
        </CarouselRow>
      )}

      {retiringSets.length > 0 && (
        <CarouselRow title="Retiring Soon" viewHref="/retiring-soon">
          {renderCards(retiringSets)}
        </CarouselRow>
      )}

      {/* Upcoming placeholder */}
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
        <p className="text-sm font-medium text-zinc-500">Upcoming Sets</p>
        <p className="mt-1 text-xs text-zinc-400">
          We&apos;re working on bringing you upcoming LEGO set announcements.
          Check back soon!
        </p>
      </div>
    </div>
  );
}
