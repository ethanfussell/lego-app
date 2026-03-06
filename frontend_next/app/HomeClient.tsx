// frontend_next/app/HomeClient.tsx
"use client";

import React, { useMemo, useRef } from "react";
import Link from "next/link";

import SetCard, { type SetLite } from "./components/SetCard";
import { useAuth } from "@/app/providers";
import SetCardActions from "@/app/components/SetCardActions";
import WelcomeBanner from "@/app/components/WelcomeBanner";
import AdSlot from "@/app/components/AdSlot";
import { FEATURED_LISTS } from "@/lib/featuredLists";

type PublicList = {
  id: number | string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  items_count?: number | null;
  owner?: string | null;
  owner_username?: string | null;
};

type Props = {
  newSets: SetLite[];
  popularSets: SetLite[];
  lists: PublicList[];
};

/* -- helpers ------------------------------------------------- */

function listTitle(l: PublicList): string {
  const t = (l.title ?? l.name ?? "").toString().trim();
  return t || `List #${String(l.id)}`;
}

function listOwner(l: PublicList): string {
  return String(l.owner ?? l.owner_username ?? "").trim();
}

function listCount(l: PublicList): number {
  const n = Number(l.items_count ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/* -- section header ------------------------------------------ */

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4">
      <h2 className="text-lg font-semibold text-zinc-900">
        {title}
      </h2>
      <Link
        href={href}
        className="shrink-0 text-sm font-medium text-amber-600 hover:text-amber-500 transition-colors"
      >
        {linkLabel} &rarr;
      </Link>
    </div>
  );
}

/* -- main component ------------------------------------------ */

export default function HomeClient({ newSets, popularSets, lists }: Props) {
  const { token, me, isAuthed } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  /* resolve featured lists from the public lists data */
  const featuredLists = useMemo(() => {
    const byId = new Map<string, PublicList>();
    for (const l of lists) byId.set(String(l.id), l);

    return FEATURED_LISTS.map((f) => {
      const real = byId.get(String(f.id));
      if (real) {
        return {
          ...real,
          title: f.title ?? real.title ?? real.name,
        } as PublicList;
      }
      return { id: f.id, title: f.title ?? null } as PublicList;
    });
  }, [lists]);

  function scrollRow(dir: 1 | -1) {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: 280 * dir, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      {/* -- Welcome banner for new users ------------------------ */}
      {isAuthed && <WelcomeBanner username={me?.username} />}

      {/* -- Hero ------------------------------------------------ */}
      <section className="mt-10 rounded-2xl border border-zinc-200 bg-gradient-to-br from-amber-50 to-white p-8 sm:p-12">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          Track your LEGO collection
        </h1>
        <p className="mt-3 max-w-xl text-lg text-zinc-500">
          Browse 19,000+ sets, rate and review your builds, compare prices, and
          keep track of everything you own and want.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/sign-up"
            className="rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/discover"
            className="rounded-full border border-zinc-200 px-6 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            Explore sets
          </Link>
        </div>
      </section>

      {/* -- Stats ------------------------------------------------ */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { value: "19,000+", label: "Sets tracked" },
          { value: "500+", label: "Active collectors" },
          { value: "2,000+", label: "Reviews & ratings" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 text-center"
          >
            <div className="text-2xl font-bold text-amber-600">{s.value}</div>
            <div className="mt-1 text-xs text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* -- Why BrickTrack --------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <div className="mt-3 font-semibold text-zinc-900">Track what you own</div>
          <p className="mt-1 text-sm text-zinc-500">Add sets to your collection and wishlist with one click.</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
          <div className="mt-3 font-semibold text-zinc-900">Compare prices</div>
          <p className="mt-1 text-sm text-zinc-500">See offers from multiple retailers side by side.</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          <div className="mt-3 font-semibold text-zinc-900">Rate & review</div>
          <p className="mt-1 text-sm text-zinc-500">Share your thoughts and see what the community thinks.</p>
        </div>
      </div>

      {/* -- New Releases ---------------------------------------- */}
      {newSets.length > 0 && (
        <section className="mt-10">
          <SectionHeader
            title="New Releases"
            href="/new"
            linkLabel="View all"
          />

          <div className="relative">
            {/* scroll buttons */}
            <button
              type="button"
              onClick={() => scrollRow(-1)}
              className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-zinc-50/90 p-1.5 text-zinc-500 shadow-sm backdrop-blur hover:bg-zinc-100 hover:text-zinc-700 sm:block transition-colors"
              aria-label="Scroll left"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollRow(1)}
              className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-zinc-50/90 p-1.5 text-zinc-500 shadow-sm backdrop-blur hover:bg-zinc-100 hover:text-zinc-700 sm:block transition-colors"
              aria-label="Scroll right"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div
              ref={scrollRef}
              className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide sm:-mx-0 sm:px-0"
            >
              {newSets.map((s) => (
                <div
                  key={s.set_num}
                  className="w-[220px] shrink-0 snap-start sm:w-[240px]"
                >
                  <SetCard set={s} footer={token ? <SetCardActions token={token} setNum={s.set_num} /> : undefined} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* -- Ad: between sections -------------------------------- */}
      <AdSlot slot="home_mid" format="horizontal" className="mt-10" />

      {/* -- Popular Among Collectors ----------------------------- */}
      {popularSets.length > 0 && (
        <section className="mt-14">
          <SectionHeader
            title="Popular Among Collectors"
            href="/discover"
            linkLabel="Discover more"
          />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {popularSets.map((s) => (
              <SetCard key={s.set_num} set={s} footer={token ? <SetCardActions token={token} setNum={s.set_num} /> : undefined} />
            ))}
          </div>
        </section>
      )}

      {/* -- Featured Lists -------------------------------------- */}
      {featuredLists.length > 0 && (
        <section className="mt-14">
          <SectionHeader
            title="Featured Lists"
            href="/lists/public"
            linkLabel="Browse all lists"
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featuredLists.map((l) => {
              const id = String(l.id);
              const title = listTitle(l);
              const owner = listOwner(l);
              const count = listCount(l);
              const desc = (l.description ?? "").toString().trim();

              return (
                <Link
                  key={id}
                  href={`/lists/${encodeURIComponent(id)}`}
                  className="group rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="font-semibold text-zinc-900 group-hover:text-amber-600 transition-colors">
                    {title}
                  </div>

                  {desc && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                      {desc}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                    {count > 0 && (
                      <span>
                        {count} set{count === 1 ? "" : "s"}
                      </span>
                    )}
                    {count > 0 && owner && (
                      <span aria-hidden="true">&middot;</span>
                    )}
                    {owner && <span>by {owner}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
