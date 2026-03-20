// frontend_next/app/(authed)/collection/CollectionClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { apiFetch, type ApiFetchOptions } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard, { type SetLite as CardSetLite } from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import CarouselRow from "@/app/components/CarouselRow";
import CreateListButton from "./CreateListButton";
import { asFiniteNumber, asTrimmedString, isRecord } from "@/lib/types";
import { useCollectionStatus } from "@/lib/useCollectionStatus";

const PREVIEW_COUNT = 10;

type ListSummary = {
  id: string | number;
  title?: string | null;
  is_public?: boolean | null;
  items_count?: number | null;
  system_key?: string | null;
};

type ListItemLike = {
  set_num?: string | null;
  setNum?: string | null;
};

type ListDetail = {
  id: string | number;
  title?: string | null;
  system_key?: string | null;
  is_public?: boolean | null;
  items_count?: number | null;

  items?: ListItemLike[] | null;
  set_nums?: string[] | null;
  setNums?: string[] | null;
};

function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  const raw = e instanceof Error ? e.message : String(e ?? fallback);
  if (/401|JWT|JWKS|signing key/i.test(raw)) {
    return "Please sign out and sign back in, or try again later.";
  }
  return raw;
}

function isSystemList(l: ListSummary): boolean {
  return String(l.system_key ?? "").trim().length > 0;
}

function toSetNums(detail: ListDetail | null | undefined): string[] {
  if (!detail) return [];

  const arr = detail.set_nums ?? detail.setNums;
  if (Array.isArray(arr)) {
    return arr.map((x) => String(x ?? "").trim()).filter(Boolean);
  }

  const items = detail.items;
  if (Array.isArray(items)) {
    return items.map((it) => String(it?.set_num ?? it?.setNum ?? "").trim()).filter(Boolean);
  }

  return [];
}

function withToken(token: string, opts: Omit<ApiFetchOptions, "token">): ApiFetchOptions {
  return { ...opts, token };
}

async function fetchSet(setNum: string, token: string): Promise<CardSetLite | null> {
  const s = String(setNum ?? "").trim();
  if (!s) return null;

  try {
    return await apiFetch<CardSetLite>(`/sets/${encodeURIComponent(s)}`, withToken(token, { cache: "no-store" }));
  } catch {
    return null;
  }
}

async function fetchSetsBulk(setNums: string[], token: string): Promise<CardSetLite[]> {
  const uniq = Array.from(new Set(setNums.map((s) => String(s ?? "").trim()).filter(Boolean)));
  if (uniq.length === 0) return [];
  const results = await Promise.all(uniq.map((sn) => fetchSet(sn, token)));
  return results.filter((x): x is CardSetLite => Boolean(x));
}

/* ------------------------------------------------------------------ */
/* Section Header                                                      */
/* ------------------------------------------------------------------ */

function SectionHeader({ label, count, action }: { label: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mt-10 mb-4 flex items-center gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{label}</h2>
      <div className="h-px flex-1 bg-zinc-100" />
      {count != null && <span className="text-xs tabular-nums text-zinc-400">{count}</span>}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Carousel Row                                                        */
/* ------------------------------------------------------------------ */

function Row({
  sets,
  href,
  emptyText = "No sets yet.",
  renderFooter,
  variant,
  token,
}: {
  sets: CardSetLite[];
  href?: string;
  emptyText?: string;
  renderFooter?: (set: CardSetLite) => React.ReactNode;
  variant?: "default" | "owned" | "wishlist" | "feed";
  token?: string;
}) {
  const hasItems = sets.length > 0;

  return (
    <CarouselRow title="" viewHref={href} emptyText={emptyText}>
      {hasItems
        ? sets.map((set) => {
            const setNum = String(set.set_num ?? "").trim();
            if (!setNum) return null;

            return (
              <div key={setNum} className="w-[220px] shrink-0">
                <SetCard set={set} variant={variant} token={token} footer={renderFooter ? renderFooter(set) : null} />
              </div>
            );
          })
        : null}
    </CarouselRow>
  );
}

/** Extended set type that carries collection metadata alongside card fields. */
type CollectionSet = CardSetLite & {
  collection_created_at?: string | null;
};

function coerceCollectionRow(raw: unknown): CollectionSet | null {
  if (!isRecord(raw)) return null;

  const sn = asTrimmedString(raw.set_num);
  if (!sn) return null;

  const name = asTrimmedString(raw.name);
  const year = asFiniteNumber(raw.year);
  const numParts = asFiniteNumber(raw.num_parts);
  const pieces = asFiniteNumber(raw.pieces);
  const theme = asTrimmedString(raw.theme);
  const imageUrl = asTrimmedString(raw.image_url);
  const originalPrice = asFiniteNumber(raw.original_price);
  const retirementStatus = asTrimmedString(raw.retirement_status);
  const collectionCreatedAt = asTrimmedString(raw.collection_created_at);

  const num_parts = numParts ?? pieces ?? null;

  return {
    set_num: sn,
    ...(name ? { name } : {}),
    ...(typeof year === "number" ? { year } : {}),
    ...(typeof num_parts === "number" ? { num_parts } : {}),
    ...(theme ? { theme } : {}),
    image_url: imageUrl ?? null,
    ...(typeof originalPrice === "number" ? { original_price: originalPrice } : {}),
    ...(retirementStatus ? { retirement_status: retirementStatus } : {}),
    ...(collectionCreatedAt ? { collection_created_at: collectionCreatedAt } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Stats Hero                                                          */
/* ------------------------------------------------------------------ */

function CollectionStatsHero({ sets, wishlistCount }: { sets: CollectionSet[]; wishlistCount: number }) {
  const stats = useMemo(() => {
    const totalPieces = sets.reduce((sum, s) => sum + (s.num_parts ?? 0), 0);
    const themeCounts = new Map<string, number>();
    for (const s of sets) {
      const t = s.theme || "Unknown";
      themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
    }
    const topThemes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { totalPieces, topThemes };
  }, [sets]);

  if (sets.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-6 sm:gap-10">
        {/* Sets */}
        <div>
          <div className="text-3xl font-bold tracking-tight text-zinc-900">{sets.length}</div>
          <div className="mt-0.5 text-xs font-medium text-zinc-500">Sets owned</div>
        </div>

        <div className="hidden sm:block h-10 w-px bg-zinc-200" />

        {/* Pieces */}
        <div>
          <div className="text-3xl font-bold tracking-tight text-zinc-900">{stats.totalPieces.toLocaleString()}</div>
          <div className="mt-0.5 text-xs font-medium text-zinc-500">Total pieces</div>
        </div>

        <div className="hidden sm:block h-10 w-px bg-zinc-200" />

        {/* Wishlist */}
        <div>
          <div className="text-3xl font-bold tracking-tight text-zinc-900">{wishlistCount}</div>
          <div className="mt-0.5 text-xs font-medium text-zinc-500">In wishlist</div>
        </div>

        {/* Top themes as pills */}
        {stats.topThemes.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {stats.topThemes.map(([theme, count]) => (
              <span key={theme} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                {theme} <span className="text-zinc-400">{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Retiring Soon Alert                                                 */
/* ------------------------------------------------------------------ */

function RetiringSoonAlert({ sets }: { sets: CollectionSet[] }) {
  const retiring = useMemo(
    () => sets.filter((s) => s.retirement_status === "retiring_soon"),
    [sets],
  );

  if (retiring.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-amber-600">&#9888;</span>
        <span className="text-sm font-semibold text-amber-800">
          {retiring.length === 1
            ? "1 wishlist set is retiring soon"
            : `${retiring.length} wishlist sets are retiring soon`}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {retiring.slice(0, 5).map((s) => (
          <a key={s.set_num} href={`/sets/${s.set_num}`} className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-200 transition-colors cursor-pointer">
            {s.name || s.set_num}
          </a>
        ))}
        {retiring.length > 5 && (
          <span className="text-[11px] text-amber-600">+{retiring.length - 5} more</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* List Cover Mosaic (larger)                                          */
/* ------------------------------------------------------------------ */

function isSafeNextImageSrc(url: string | null | undefined): boolean {
  if (!url) return false;
  const t = url.trim();
  return t.startsWith("https://") || t.startsWith("http://") || t.startsWith("/");
}

function ListCoverMosaic({ images }: { images: (string | null | undefined)[] }) {
  const urls = images.filter(isSafeNextImageSrc).slice(0, 4) as string[];
  if (urls.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl w-16 h-16 shrink-0 bg-zinc-100">
      {urls.map((src, i) => (
        <div key={i} className="relative aspect-square w-full bg-white">
          <Image src={src} alt="" fill className="object-contain" sizes="32px" />
        </div>
      ))}
      {Array.from({ length: Math.max(0, 4 - urls.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="aspect-square w-full bg-zinc-100" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chevron Right Icon                                                  */
/* ------------------------------------------------------------------ */

function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function CollectionClient() {
  const { token } = useAuth();
  const { isOwned, isWishlist } = useCollectionStatus();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [lists, setLists] = useState<ListSummary[]>([]);
  const [ownedDetail, setOwnedDetail] = useState<ListDetail | null>(null);
  const [wishlistDetail, setWishlistDetail] = useState<ListDetail | null>(null);

  const [ownedAll, setOwnedAll] = useState<CollectionSet[]>([]);
  const [wishlistAll, setWishlistAll] = useState<CollectionSet[]>([]);
  const [ownedPreview, setOwnedPreview] = useState<CardSetLite[]>([]);
  const [wishlistPreview, setWishlistPreview] = useState<CardSetLite[]>([]);
  const [customPreviewById, setCustomPreviewById] = useState<Record<string, CardSetLite[]>>({});
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});

  const customLists = useMemo(() => lists.filter((l) => !isSystemList(l)), [lists]);

  const renderFooterForSet = useCallback(
    (set: CardSetLite) => {
      if (!token) return null;
      return <SetCardActions token={token} setNum={set.set_num} isOwned={isOwned(set.set_num)} isWishlist={isWishlist(set.set_num)} />;
    },
    [token, isOwned, isWishlist]
  );

  const refreshAll = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setErr(null);

    try {
      const mine = await apiFetch<ListSummary[]>("/lists/me", withToken(token, { cache: "no-store" }));
      const mineArr = Array.isArray(mine) ? mine : [];
      setLists(mineArr);

      const [ownedRowsU, wishRowsU, reviewsU] = await Promise.all([
        apiFetch<unknown>("/collections/me/owned", withToken(token, { cache: "no-store" })),
        apiFetch<unknown>("/collections/me/wishlist", withToken(token, { cache: "no-store" })),
        apiFetch<unknown>("/sets/reviews/me?limit=500", withToken(token, { cache: "no-store" })).catch(() => []),
      ]);

      const ratingsMap: Record<string, number> = {};
      if (Array.isArray(reviewsU)) {
        for (const r of reviewsU) {
          if (isRecord(r) && typeof r.set_num === "string" && typeof r.rating === "number") {
            ratingsMap[r.set_num] = r.rating;
          }
        }
      }
      setUserRatings(ratingsMap);

      const ownedRows = Array.isArray(ownedRowsU) ? ownedRowsU : [];
      const wishRows = Array.isArray(wishRowsU) ? wishRowsU : [];

      const ownedSetsAll = ownedRows
        .map(coerceCollectionRow)
        .filter((x): x is CollectionSet => Boolean(x));

      const wishSetsAll = wishRows
        .map(coerceCollectionRow)
        .filter((x): x is CollectionSet => Boolean(x));

      setOwnedAll(ownedSetsAll);
      setWishlistAll(wishSetsAll);
      setOwnedPreview(ownedSetsAll.slice(0, PREVIEW_COUNT));
      setWishlistPreview(wishSetsAll.slice(0, PREVIEW_COUNT));

      setOwnedDetail({
        id: "owned",
        title: "Owned",
        system_key: "owned",
        items_count: ownedSetsAll.length,
      });

      setWishlistDetail({
        id: "wishlist",
        title: "Wishlist",
        system_key: "wishlist",
        items_count: wishSetsAll.length,
      });

      const customOnly = mineArr.filter((l) => !isSystemList(l));

      const entries = await Promise.all(
        customOnly.map(async (l): Promise<{ id: string; sets: CardSetLite[] }> => {
          const id = String(l.id);

          try {
            const d = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(id)}`, withToken(token, { cache: "no-store" }));
            const nums = toSetNums(d).slice(0, PREVIEW_COUNT);
            const sets = await fetchSetsBulk(nums, token);
            return { id, sets };
          } catch {
            return { id, sets: [] };
          }
        })
      );

      const map: Record<string, CardSetLite[]> = {};
      for (const e of entries) map[e.id] = e.sets;
      setCustomPreviewById(map);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to load collection"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLists([]);
      setOwnedDetail(null);
      setWishlistDetail(null);
      setOwnedAll([]);
      setWishlistAll([]);
      setOwnedPreview([]);
      setWishlistPreview([]);
      setCustomPreviewById({});
      setUserRatings({});
      setErr(null);
      setLoading(false);
      return;
    }

    void refreshAll();
  }, [token, refreshAll]);

  const ownedWithRatings = useMemo(() => {
    if (ownedPreview.length === 0) return ownedPreview;
    return ownedPreview.map((s) => ({
      ...s,
      user_rating: userRatings[s.set_num] ?? undefined,
    }));
  }, [ownedPreview, userRatings]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* Header */}
      <div className="pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">My Collection</h1>
        <p className="mt-1 text-sm text-zinc-500">Track your sets, wishlist, and custom lists.</p>
      </div>

      {loading ? (
        <div className="mt-6 animate-pulse space-y-3">
          <div className="h-4 w-32 rounded bg-zinc-200" />
          <div className="h-3 w-24 rounded bg-zinc-100" />
        </div>
      ) : null}
      {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      {/* Stats Hero */}
      {!loading && <CollectionStatsHero sets={ownedAll} wishlistCount={wishlistAll.length} />}

      {/* Owned Section */}
      <SectionHeader label="Owned" count={ownedDetail?.items_count ?? undefined} />
      <Row
        sets={ownedWithRatings}
        href="/collection/owned"
        variant="owned"
        token={token ?? undefined}
      />

      {/* Retiring Soon Alert */}
      <RetiringSoonAlert sets={wishlistAll} />

      {/* Wishlist Section */}
      <SectionHeader label="Wishlist" count={wishlistDetail?.items_count ?? undefined} />
      <Row
        sets={wishlistPreview}
        href="/collection/wishlist"
        renderFooter={renderFooterForSet}
      />

      {/* Custom Lists Section */}
      {(customLists.length > 0 || !loading) && (
        <>
          <SectionHeader
            label="Your Lists"
            count={customLists.length > 0 ? customLists.length : undefined}
            action={
              token ? (
                <CreateListButton
                  token={token}
                  onCreated={async () => {
                    await refreshAll();
                  }}
                />
              ) : null
            }
          />

          {customLists.length === 0 && !loading ? (
            <p className="text-sm text-zinc-400">No custom lists yet. Create one to organize your sets.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {customLists.map((l) => {
                const id = String(l.id);
                const sets = customPreviewById[id] ?? [];
                const count = l.items_count ?? 0;

                return (
                  <Link
                    key={id}
                    href={`/lists/${encodeURIComponent(id)}`}
                    className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
                  >
                    <ListCoverMosaic images={sets.map((s) => s.image_url)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-900 transition-colors group-hover:text-amber-600">
                        {l.title ?? `List ${id}`}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {l.is_public ? "Public" : "Private"} &middot; {count} sets
                      </div>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
