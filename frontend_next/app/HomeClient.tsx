// frontend_next/app/HomeClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { isRecord } from "@/lib/types";
import { FEATURED_LISTS } from "@/lib/featuredLists";

type PublicList = {
  id: string | number;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  items_count?: number | null;
  owner?: string | null;
  owner_username?: string | null;
  username?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type UnknownRecord = Record<string, unknown>;

const CARD_MIN_WIDTH = 220;

function asTrimmedString(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function coercePublicList(raw: unknown): PublicList | null {
  if (!isRecord(raw)) return null;
  const o = raw as UnknownRecord;

  const idStr = asTrimmedString(o.id);
  const idNum = asFiniteNumber(o.id);
  const id: string | number | null = idStr ?? idNum ?? null;
  if (id == null) return null;

  const out: PublicList = {
    id,
    title: asTrimmedString(o.title),
    name: asTrimmedString(o.name),
    description: asTrimmedString(o.description),
    items_count: asFiniteNumber(o.items_count),
    owner: asTrimmedString(o.owner),
    owner_username: asTrimmedString(o.owner_username),
    username: asTrimmedString(o.username),
    updated_at: asTrimmedString(o.updated_at),
    created_at: asTrimmedString(o.created_at),
  };

  return out;
}

function pickArrayOrResults(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data)) {
    const r = (data as UnknownRecord).results;
    if (Array.isArray(r)) return r as unknown[];
  }
  return [];
}

function FeaturedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-extrabold text-amber-700 dark:text-amber-300">
      Featured
    </span>
  );
}

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

function pickTitle(l: PublicList): string {
  const t = (l.title ?? l.name ?? "").toString().trim();
  return t || `List #${String(l.id)}`;
}

function pickOwner(l: PublicList): string {
  return String(l.owner ?? l.owner_username ?? l.username ?? "").trim();
}

function pickCount(l: PublicList): number {
  const n = Number(l.items_count ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function mergeFeaturedOverrides(detail: PublicList, f: { id: number; title?: string }) {
  const overrideTitle = typeof f.title === "string" ? f.title.trim() : "";
  if (overrideTitle) return { ...detail, title: overrideTitle };
  return detail;
}

function ClickCard({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div
      role="link"
      tabIndex={0}
      className={className}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </div>
  );
}

export default function HomeClient() {
  const dealsRowRef = useRef<HTMLDivElement | null>(null);
  const retiringRowRef = useRef<HTMLDivElement | null>(null);

  const [lists, setLists] = useState<PublicList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [listsErr, setListsErr] = useState<string>("");

  const [featured, setFeatured] = useState<PublicList[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(false);

  function scrollRow(ref: React.RefObject<HTMLDivElement | null>, direction = 1) {
    if (!ref.current) return;
    const scrollAmount = CARD_MIN_WIDTH * 2.2 * direction;
    ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFeatured() {
      if (!Array.isArray(FEATURED_LISTS) || FEATURED_LISTS.length === 0) return;

      try {
        setLoadingFeatured(true);

        const results = await Promise.all(
          FEATURED_LISTS.slice(0, 12).map(async (f) => {
            const id = String(f.id);
            const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, { cache: "no-store" });
            if (!res.ok) return null;

            const data: unknown = await res.json().catch(() => null);
            const detail = coercePublicList(data);
            if (!detail) return null;

            // ensure ID matches featured
            const fixed: PublicList = { ...detail, id: detail.id ?? f.id };
            return mergeFeaturedOverrides(fixed, f);
          })
        );

        if (cancelled) return;
        setFeatured(results.filter((x): x is PublicList => Boolean(x)));
      } catch {
        if (!cancelled) setFeatured([]);
      } finally {
        if (!cancelled) setLoadingFeatured(false);
      }
    }

    void loadFeatured();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadingLists(true);
        setListsErr("");

        const data = await apiFetch<unknown>("/lists/public", { cache: "no-store" });
        const rows = pickArrayOrResults(data);

        const parsed = rows.map(coercePublicList).filter((x): x is PublicList => Boolean(x));

        if (!cancelled) setLists(parsed.slice(0, 6));
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
  }, []);

  const featuredById = useMemo(() => new Set(featured.map((x) => String(x.id))), [featured]);

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

      {/* FEATURED LISTS */}
      {Array.isArray(FEATURED_LISTS) && FEATURED_LISTS.length > 0 ? (
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="m-0 text-lg font-semibold">⭐ Featured lists</h2>
                <FeaturedBadge />
              </div>
              <p className="mt-1 text-sm text-zinc-500">Curated picks. Click to see the sets inside.</p>
            </div>
            <Link href="/lists/public" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Browse all lists →
            </Link>
          </div>

          {loadingFeatured ? <p className="mt-4 text-sm text-zinc-500">Loading featured…</p> : null}

          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
            {(featured.length
              ? featured
              : FEATURED_LISTS.slice(0, 10).map((f) => ({ id: f.id, title: f.title } as PublicList))
            ).map((l) => {
              const id = String(l.id);
              const title = pickTitle(l);
              const owner = pickOwner(l);
              const count = pickCount(l);
              const desc = String(l.description ?? "").trim();
              const href = `/lists/${encodeURIComponent(id)}`;

              return (
                <ClickCard
                  key={id}
                  href={href}
                  className="cursor-pointer rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[.14] dark:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-extrabold text-zinc-900 dark:text-zinc-50">{title}</div>

                      <div className="mt-1 text-xs text-zinc-500">
                        {owner ? (
                          <>
                            by{" "}
                            <Link
                              href={`/users/${encodeURIComponent(owner)}`}
                              className="font-semibold hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {owner}
                            </Link>
                            <span className="mx-1">•</span>
                          </>
                        ) : null}
                        {count} set{count === 1 ? "" : "s"}
                      </div>
                    </div>

                    <FeaturedBadge />
                  </div>

                  {desc ? (
                    <div className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{desc}</div>
                  ) : (
                    <div className="mt-2 text-sm text-zinc-500">View list →</div>
                  )}
                </ClickCard>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* FEATURED SETS (placeholder) */}
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

        <div ref={dealsRowRef} className="mt-4 flex gap-4 overflow-x-auto pb-2" style={{ scrollSnapType: "x mandatory" }}>
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
            <p className="mt-1 text-sm text-zinc-500">Great for urgency / FOMO and “last chance” buttons with affiliate links.</p>
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
          <p className="mt-2 text-sm text-zinc-500">Curated lists from the community. Click to see the sets inside.</p>

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
                const id = String(list.id);
                const title = pickTitle(list);
                const owner = pickOwner(list) || "unknown";
                const count = pickCount(list);
                const href = `/lists/${encodeURIComponent(id)}`;
                const isFeatured = featuredById.has(id);

                return (
                  <ClickCard
                    key={id}
                    href={href}
                    className="cursor-pointer rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[.14] dark:bg-zinc-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-extrabold text-zinc-900 dark:text-zinc-50">{title}</div>

                        {list.description ? (
                          <div className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {String(list.description)}
                          </div>
                        ) : null}

                        <div className="mt-2 text-xs text-zinc-500">
                          {count} set{count === 1 ? "" : "s"} · by{" "}
                          <Link
                            href={`/users/${encodeURIComponent(owner)}`}
                            className="font-semibold hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {owner}
                          </Link>
                        </div>
                      </div>

                      {isFeatured ? <FeaturedBadge /> : null}
                    </div>
                  </ClickCard>
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