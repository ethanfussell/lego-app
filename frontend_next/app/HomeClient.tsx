// frontend_next/app/HomeClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { isRecord } from "@/lib/types";
import { FEATURED_LISTS } from "@/lib/featuredLists";

type PublicList = {
  id: string | number;
  title?: string;
  name?: string;
  description?: string;
  items_count?: number;
  owner?: string;
  owner_username?: string;
  username?: string;
};

const CARD_MIN_WIDTH = 220;

function PlaceholderSetCard() {
  return (
    <div
      className="shrink-0 snap-start rounded-xl border border-black/[.08] bg-white p-3 shadow-sm dark:border-white/[.14] dark:bg-zinc-950"
      style={{ minWidth: CARD_MIN_WIDTH, maxWidth: CARD_MIN_WIDTH, minHeight: 160 }}
    >
      <div
        className="mb-2 h-[100px] rounded-lg"
        style={{
          background:
            "repeating-linear-gradient(45deg, rgba(0,0,0,.06), rgba(0,0,0,.06) 10px, rgba(0,0,0,.03) 10px, rgba(0,0,0,.03) 20px)",
        }}
      />
      <div className="mb-1 h-3 rounded-full bg-black/[.08] dark:bg-white/[.10]" />
      <div className="mb-1 h-3 w-2/3 rounded-full bg-black/[.06] dark:bg-white/[.08]" />
      <div className="h-3 w-1/2 rounded-full bg-black/[.05] dark:bg-white/[.06]" />
    </div>
  );
}

function RowNav({
  onLeft,
  onRight,
  href,
  hrefLabel,
}: {
  onLeft: () => void;
  onRight: () => void;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onLeft}
        className="rounded-full border border-black/[.10] bg-white px-2 py-1 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
      >
        ◀
      </button>
      <button
        type="button"
        onClick={onRight}
        className="rounded-full border border-black/[.10] bg-white px-2 py-1 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
      >
        ▶
      </button>

      {href ? (
        <Link href={href} className="ml-1 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
          {hrefLabel || "View all →"}
        </Link>
      ) : null}
    </div>
  );
}

function FeaturedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-extrabold text-amber-700 dark:text-amber-300">
      Featured
    </span>
  );
}

export default function HomeClient() {
  const dealsRowRef = useRef<HTMLDivElement | null>(null);
  const retiringRowRef = useRef<HTMLDivElement | null>(null);

  const [lists, setLists] = useState<PublicList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [listsErr, setListsErr] = useState<string>("");

  const featuredIds = useMemo(() => new Set((FEATURED_LISTS || []).map((x) => String(x.id))), []);

  function scrollRow(ref: React.RefObject<HTMLDivElement | null>, direction = 1) {
    if (!ref.current) return;
    const scrollAmount = CARD_MIN_WIDTH * 2.2 * direction; // ~2 cards at a time
    ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }

  // Load popular public lists (client-side)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadingLists(true);
        setListsErr("");

        const data = await apiFetch<unknown>("/lists/public", { cache: "no-store" });

        const arr: PublicList[] = Array.isArray(data)
          ? (data as PublicList[])
          : isRecord(data) && Array.isArray(data.results)
            ? (data.results as PublicList[])
            : [];

        // Avoid duplicating featured lists in the "Popular public lists" section
        const filtered = arr.filter((x) => !featuredIds.has(String(x.id)));

        if (!cancelled) setLists(filtered.slice(0, 6));
      } catch (e: unknown) {
        if (!cancelled) setListsErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [featuredIds]);

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16">
      {/* HERO */}
      <section className="mt-10 rounded-2xl border border-black/[.08] bg-zinc-50 p-6 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
        <h1 className="m-0 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Track your LEGO collection &amp; find the best deals
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Rate sets, track what you own and want, and compare prices before you buy. Built for LEGO nerds like us.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/search"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-white dark:text-zinc-900"
          >
            🔍 Start searching sets
          </Link>

          <Link
            href="/login"
            className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            📋 Log in to track your collection
          </Link>
        </div>
      </section>

      {/* FEATURED LISTS (Task 8 + Task 9) */}
      {FEATURED_LISTS?.length ? (
        <section className="mt-10 rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="m-0 text-lg font-semibold">Featured lists</h2>
                <FeaturedBadge />
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Curated picks to explore.</p>
            </div>

            <Link href="/lists/public" className="text-sm font-semibold hover:underline">
              Browse all lists →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_LISTS.slice(0, 10).map((f) => {
              const id = String(f.id);
              const title = (f.title && String(f.title).trim()) || `List #${id}`;
              const desc = (f.description && String(f.description).trim()) || "";
              const owner = (f.owner && String(f.owner).trim()) || "";

              return (
                <Link
                  key={id}
                  href={`/lists/${encodeURIComponent(id)}`}
                  className="block rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-white/[.14] dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>
                      {owner ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          by <span className="font-semibold">{owner}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0">
                      <FeaturedBadge />
                    </div>
                  </div>

                  {desc ? (
                    <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">View list →</p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* FEATURED */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold">⭐ Featured sets</h2>
          <span className="text-xs text-zinc-500">Hand-picked highlights (coming soon)</span>
        </div>

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {[1, 2, 3, 4].map((n) => (
            <PlaceholderSetCard key={n} />
          ))}
        </div>
      </section>

      {/* DEALS */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-semibold">💸 Deals &amp; price drops</h2>
            <p className="mt-1 text-sm text-zinc-500">
              This will show live discounts and price history once we plug in data — perfect for affiliate links.
            </p>
          </div>

          <RowNav
            onLeft={() => scrollRow(dealsRowRef, -1)}
            onRight={() => scrollRow(dealsRowRef, 1)}
            href="/sale"
            hrefLabel="View all deals →"
          />
        </div>

        <div
          ref={dealsRowRef}
          className="mt-4 flex gap-4 overflow-x-auto pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <PlaceholderSetCard key={n} />
          ))}
        </div>
      </section>

      {/* RETIRING */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-semibold">⏰ Retiring soon</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Great for urgency / FOMO and “last chance” buttons with affiliate links.
            </p>
          </div>

          <RowNav
            onLeft={() => scrollRow(retiringRowRef, -1)}
            onRight={() => scrollRow(retiringRowRef, 1)}
            href="/retiring-soon"
            hrefLabel="View retiring →"
          />
        </div>

        <div
          ref={retiringRowRef}
          className="mt-4 flex gap-4 overflow-x-auto pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <PlaceholderSetCard key={n} />
          ))}
        </div>
      </section>

      {/* TRENDING + POPULAR LISTS */}
      <section className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
        <div>
          <h2 className="m-0 text-lg font-semibold">🔥 Trending now</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Most-viewed and most-added sets across the site (later we can drive this from real analytics).
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>• Placeholder: “Trending Castle set”</li>
            <li>• Placeholder: “New Star Wars starfighter”</li>
            <li>• Placeholder: “Popular Ideas set”</li>
          </ul>
        </div>

        <div>
          <h2 className="m-0 text-lg font-semibold">📋 Popular public lists</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Curated lists from the community. Click to see the sets inside.
          </p>

          {loadingLists ? <p className="mt-4 text-sm">Loading public lists…</p> : null}
          {listsErr ? <p className="mt-4 text-sm text-red-600">Error: {listsErr}</p> : null}

          {!loadingLists && !listsErr && lists.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No public lists yet. Once you create some and mark them public, they’ll show up here.
            </p>
          ) : null}

          {!loadingLists && !listsErr && lists.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {lists.map((list) => {
                const id = list.id;
                const title = list.title || list.name || "Untitled list";
                const owner = list.owner || list.owner_username || list.username || "unknown";
                const count = Number(list.items_count ?? 0);

                return (
                  <Link
                    key={String(id)}
                    href={`/lists/${encodeURIComponent(String(id))}`}
                    className="block rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm hover:shadow-md dark:border-white/[.14] dark:bg-zinc-950"
                  >
                    <div className="font-extrabold text-zinc-900 dark:text-zinc-50">{title}</div>
                    {list.description ? (
                      <div className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {list.description}
                      </div>
                    ) : null}
                    <div className="mt-2 text-xs text-zinc-500">
                      {count} sets · by <span className="font-semibold">{owner}</span>
                    </div>
                  </Link>
                );
              })}

              <Link href="/lists/public" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Browse all public lists →
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}