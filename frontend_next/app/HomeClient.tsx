// frontend_next/app/HomeClient.tsx
"use client";

import React, { useMemo, useRef } from "react";
import Link from "next/link";

import SetCard, { type SetLite } from "./components/SetCard";
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

/* ── helpers ─────────────────────────────────────────── */

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

/* ── section header ──────────────────────────────────── */

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
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <Link
        href={href}
        className="shrink-0 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {linkLabel} &rarr;
      </Link>
    </div>
  );
}

/* ── main component ──────────────────────────────────── */

export default function HomeClient({ newSets, popularSets, lists }: Props) {
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
      {/* ── New Releases ─────────────────────────────── */}
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
              className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-white/90 p-1.5 text-zinc-600 shadow-sm backdrop-blur hover:bg-white sm:block dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label="Scroll left"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollRow(1)}
              className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-white/90 p-1.5 text-zinc-600 shadow-sm backdrop-blur hover:bg-white sm:block dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
                  <SetCard set={s} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Popular Sets ─────────────────────────────── */}
      {popularSets.length > 0 && (
        <section className="mt-14">
          <SectionHeader
            title="Popular Sets"
            href="/discover"
            linkLabel="Discover more"
          />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {popularSets.map((s) => (
              <SetCard key={s.set_num} set={s} />
            ))}
          </div>
        </section>
      )}

      {/* ── Featured Lists ───────────────────────────── */}
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
                  className="group rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-200">
                    {title}
                  </div>

                  {desc && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {desc}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
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
