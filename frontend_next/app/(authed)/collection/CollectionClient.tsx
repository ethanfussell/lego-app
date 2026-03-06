// frontend_next/app/(authed)/collection/CollectionClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, type ApiFetchOptions } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard, { type SetLite as CardSetLite } from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import QuickCollectionsAdd from "@/app/components/QuickCollectionsAdd";
import CarouselRow from "@/app/components/CarouselRow";
import CreateListButton from "./CreateListButton";

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

type UnknownRecord = Record<string, unknown>;

function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof Error ? e.message : String(e ?? fallback);
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asTrimmedString(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
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
}: {
  title: string;
  subtitle?: string;
  sets: CardSetLite[];
  href?: string;
  emptyText?: string;
  renderFooter?: (set: CardSetLite) => React.ReactNode;
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
                  <SetCard set={set} footer={renderFooter ? renderFooter(set) : null} />
                </div>
              );
            })
          : null}
      </CarouselRow>
    </div>
  );
}

function coerceCollectionRowToCardSetLite(raw: unknown): CardSetLite | null {
  if (!isRecord(raw)) return null;

  const sn = asTrimmedString(raw.set_num);
  if (!sn) return null;

  const name = asTrimmedString(raw.name);
  const year = asFiniteNumber(raw.year);
  const numParts = asFiniteNumber(raw.num_parts);
  const pieces = asFiniteNumber(raw.pieces);
  const theme = asTrimmedString(raw.theme);
  const imageUrl = asTrimmedString(raw.image_url);

  // CardSetLite supports either `pieces` or `num_parts` in different places; we’ll prefer num_parts if present.
  const num_parts = numParts ?? pieces ?? null;

  const out: CardSetLite = {
    set_num: sn,
    ...(name ? { name } : {}),
    ...(typeof year === "number" ? { year } : {}),
    ...(typeof num_parts === "number" ? { num_parts } : {}),
    ...(theme ? { theme } : {}),
    image_url: imageUrl ?? null,
  };

  return out;
}

export default function CollectionClient() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [lists, setLists] = useState<ListSummary[]>([]);
  const [ownedDetail, setOwnedDetail] = useState<ListDetail | null>(null);
  const [wishlistDetail, setWishlistDetail] = useState<ListDetail | null>(null);

  const [ownedPreview, setOwnedPreview] = useState<CardSetLite[]>([]);
  const [wishlistPreview, setWishlistPreview] = useState<CardSetLite[]>([]);
  const [customPreviewById, setCustomPreviewById] = useState<Record<string, CardSetLite[]>>({});

  const customLists = useMemo(() => lists.filter((l) => !isSystemList(l)), [lists]);

  const renderFooterForSet = useCallback(
    (set: CardSetLite) => {
      if (!token) return null;
      return <SetCardActions token={token} setNum={set.set_num} />;
    },
    [token]
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
      const [ownedRowsU, wishRowsU] = await Promise.all([
        apiFetch<unknown>("/collections/me/owned", withToken(token, { cache: "no-store" })),
        apiFetch<unknown>("/collections/me/wishlist", withToken(token, { cache: "no-store" })),
      ]);

      const ownedRows = Array.isArray(ownedRowsU) ? ownedRowsU : [];
      const wishRows = Array.isArray(wishRowsU) ? wishRowsU : [];

      const ownedSetsAll = ownedRows
        .map(coerceCollectionRowToCardSetLite)
        .filter((x): x is CardSetLite => Boolean(x));

      const wishSetsAll = wishRows
        .map(coerceCollectionRowToCardSetLite)
        .filter((x): x is CardSetLite => Boolean(x));

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
      setOwnedPreview([]);
      setWishlistPreview([]);
      setCustomPreviewById({});
      setErr(null);
      setLoading(false);
      return;
    }

    void refreshAll();
  }, [token, refreshAll]);

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

        <div className="mt-5 max-w-xl">
          <QuickCollectionsAdd onCollectionsChanged={refreshAll} />
        </div>
      </div>

      {loading ? <div className="mt-6 animate-pulse space-y-3"><div className="h-4 w-32 rounded bg-zinc-200" /><div className="h-3 w-24 rounded bg-zinc-100" /></div> : null}
      {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      <Row
        title="Owned"
        sets={ownedPreview}
        href="/collection/owned"
        renderFooter={renderFooterForSet}
        {...(ownedDetail?.items_count ? { subtitle: `${ownedDetail.items_count} sets` } : {})}
      />

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
          <Row
            key={id}
            title={l.title ?? `List ${id}`}
            sets={sets}
            href={`/lists/${encodeURIComponent(id)}`}
            renderFooter={renderFooterForSet}
            subtitle={`${l.is_public ? "Public" : "Private"} • ${count} sets`}
          />
        );
      })}
    </div>
  );
}