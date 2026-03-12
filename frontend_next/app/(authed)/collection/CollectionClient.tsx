// frontend_next/app/(authed)/collection/CollectionClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { apiFetch, type ApiFetchOptions } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard, { type SetLite as CardSetLite } from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import CarouselRow from "@/app/components/CarouselRow";
import CreateListButton from "./CreateListButton";
import { asFiniteNumber, asTrimmedString, isRecord, type UnknownRecord } from "@/lib/types";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import { formatPrice } from "@/lib/format";

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
  // Hide noisy backend details from auth errors
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

function Row({
  title,
  subtitle,
  sets,
  href,
  emptyText = "No sets yet.",
  renderFooter,
  variant,
  token,
}: {
  title: string;
  subtitle?: string;
  sets: CardSetLite[];
  href?: string;
  emptyText?: string;
  renderFooter?: (set: CardSetLite) => React.ReactNode;
  variant?: "default" | "owned" | "wishlist" | "feed";
  token?: string;
}) {
  const hasItems = sets.length > 0;

  return (
    <div className="mt-8">
      <CarouselRow title={title} viewHref={href} emptyText={emptyText} {...(subtitle ? { subtitle } : {})}>
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
    </div>
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

// Keep backward compat alias
function coerceCollectionRowToCardSetLite(raw: unknown): CardSetLite | null {
  return coerceCollectionRow(raw);
}

/* ------------------------------------------------------------------ */
/* Feature 1: Collection Stats Dashboard                               */
/* ------------------------------------------------------------------ */

function CollectionStatsDashboard({ sets }: { sets: CollectionSet[] }) {
  const stats = useMemo(() => {
    const totalPieces = sets.reduce((sum, s) => sum + (s.num_parts ?? 0), 0);
    const totalValue = sets.reduce((sum, s) => sum + (s.original_price ?? 0), 0);
    const themeCounts = new Map<string, number>();
    for (const s of sets) {
      const t = s.theme || "Unknown";
      themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
    }
    const topThemes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { totalPieces, totalValue, topThemes };
  }, [sets]);

  if (sets.length === 0) return null;

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
        <div className="text-2xl font-bold text-amber-600">{sets.length}</div>
        <div className="mt-1 text-xs text-zinc-500">Sets owned</div>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
        <div className="text-2xl font-bold text-amber-600">{stats.totalPieces.toLocaleString()}</div>
        <div className="mt-1 text-xs text-zinc-500">Total pieces</div>
      </div>
      {stats.totalValue > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{formatPrice(stats.totalValue) ?? "$0"}</div>
          <div className="mt-1 text-xs text-zinc-500">Est. value</div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-zinc-300">&mdash;</div>
          <div className="mt-1 text-xs text-zinc-500">Est. value</div>
        </div>
      )}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">Top themes</div>
        <div className="space-y-0.5">
          {stats.topThemes.map(([theme, count]) => (
            <div key={theme} className="flex items-center justify-between text-xs">
              <span className="truncate text-zinc-600">{theme}</span>
              <span className="shrink-0 font-semibold text-zinc-900">{count}</span>
            </div>
          ))}
          {stats.topThemes.length === 0 && <div className="text-xs text-zinc-400">No themes yet</div>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feature 2: Retiring Soon Alert                                      */
/* ------------------------------------------------------------------ */

function RetiringSoonAlert({ sets }: { sets: CollectionSet[] }) {
  const retiring = useMemo(
    () => sets.filter((s) => s.retirement_status === "retiring_soon"),
    [sets],
  );

  if (retiring.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-600 text-sm">&#9888;</span>
        <span className="text-sm font-semibold text-amber-800">
          {retiring.length === 1
            ? "1 wishlist set is retiring soon"
            : `${retiring.length} wishlist sets are retiring soon`}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {retiring.slice(0, 5).map((s) => (
          <span key={s.set_num} className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            {s.name || s.set_num}
          </span>
        ))}
        {retiring.length > 5 && (
          <span className="text-[11px] text-amber-600">+{retiring.length - 5} more</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feature 4: List Cover Mosaic                                        */
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
    <div className="grid grid-cols-2 gap-0.5 rounded-lg overflow-hidden w-14 h-14 shrink-0 bg-zinc-100">
      {urls.map((src, i) => (
        <div key={i} className="relative w-full aspect-square bg-white">
          <Image src={src} alt="" fill className="object-contain" sizes="28px" />
        </div>
      ))}
      {/* Fill empty slots with gray */}
      {Array.from({ length: Math.max(0, 4 - urls.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="w-full aspect-square bg-zinc-100" />
      ))}
    </div>
  );
}

export default function CollectionClient() {
  const { token } = useAuth();
  const { isOwned, isWishlist, getUserRating } = useCollectionStatus();

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
      // Custom lists
      const mine = await apiFetch<ListSummary[]>("/lists/me", withToken(token, { cache: "no-store" }));
      const mineArr = Array.isArray(mine) ? mine : [];
      setLists(mineArr);

      // System collections
      const [ownedRowsU, wishRowsU, reviewsU] = await Promise.all([
        apiFetch<unknown>("/collections/me/owned", withToken(token, { cache: "no-store" })),
        apiFetch<unknown>("/collections/me/wishlist", withToken(token, { cache: "no-store" })),
        apiFetch<unknown>("/sets/reviews/me?limit=500", withToken(token, { cache: "no-store" })).catch(() => []),
      ]);

      // Build user ratings map from reviews
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

      // Custom list previews via list detail → set nums → fetch sets
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

  // Owned sets enriched with user ratings
  const ownedWithRatings = useMemo(() => {
    if (ownedPreview.length === 0) return ownedPreview;
    return ownedPreview.map((s) => ({
      ...s,
      user_rating: userRatings[s.set_num] ?? undefined,
    }));
  }, [ownedPreview, userRatings]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">My Collection</h1>

        <div className="mt-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">My lists</h2>

          {token ? (
            <CreateListButton
              token={token}
              onCreated={async () => {
                await refreshAll();
              }}
            />
          ) : null}
        </div>

        <p className="mt-2 text-sm text-zinc-500">Owned, Wishlist, and your custom lists.</p>
      </div>

      {loading ? <div className="mt-6 animate-pulse space-y-3"><div className="h-4 w-32 rounded bg-zinc-200" /><div className="h-3 w-24 rounded bg-zinc-100" /></div> : null}
      {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      {/* Feature 1: Stats Dashboard */}
      {!loading && <CollectionStatsDashboard sets={ownedAll} />}

      <Row
        title="Owned"
        sets={ownedWithRatings}
        href="/collection/owned"
        variant="owned"
        token={token ?? undefined}
        {...(ownedDetail?.items_count ? { subtitle: `${ownedDetail.items_count} sets` } : {})}
      />

      {/* Feature 2: Retiring Soon Alert */}
      <RetiringSoonAlert sets={wishlistAll} />

      <Row
        title="Wishlist"
        sets={wishlistPreview}
        href="/collection/wishlist"
        renderFooter={renderFooterForSet}
        {...(wishlistDetail?.items_count ? { subtitle: `${wishlistDetail.items_count} sets` } : {})}
      />

      {customLists.map((l) => {
        const id = String(l.id);
        const sets = customPreviewById[id] ?? [];
        const count = l.items_count ?? 0;

        return (
          <div key={id} className="mt-8">
            {/* Feature 4: List Cover Mosaic */}
            <div className="flex items-center gap-3 mb-1">
              <ListCoverMosaic images={sets.map((s) => s.image_url)} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900 truncate">{l.title ?? `List ${id}`}</div>
                <div className="text-xs text-zinc-500">{l.is_public ? "Public" : "Private"} &middot; {count} sets</div>
              </div>
            </div>
            <CarouselRow title="" viewHref={`/lists/${encodeURIComponent(id)}`} emptyText="No sets yet.">
              {sets.length > 0
                ? sets.map((set) => {
                    const setNum = String(set.set_num ?? "").trim();
                    if (!setNum) return null;
                    return (
                      <div key={setNum} className="w-[220px] shrink-0">
                        <SetCard set={set} footer={renderFooterForSet(set)} />
                      </div>
                    );
                  })
                : null}
            </CarouselRow>
          </div>
        );
      })}
    </div>
  );
}