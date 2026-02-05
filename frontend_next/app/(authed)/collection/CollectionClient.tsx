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

function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof Error ? e.message : String(e ?? fallback);
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
    return items
      .map((it) => String(it?.set_num ?? it?.setNum ?? "").trim())
      .filter(Boolean);
  }

  return [];
}

function withToken(
  token: string,
  opts: Omit<ApiFetchOptions, "token">
): ApiFetchOptions {
  return { ...opts, token };
}

async function fetchSet(setNum: string, token: string): Promise<CardSetLite | null> {
  const s = String(setNum ?? "").trim();
  if (!s) return null;

  try {
    return await apiFetch<CardSetLite>(
      `/sets/${encodeURIComponent(s)}`,
      withToken(token, { cache: "no-store" })
    );
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
      <CarouselRow
        title={title}
        viewHref={href}
        emptyText={emptyText}
        {...(subtitle ? { subtitle } : {})}
      >
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
      const mine = await apiFetch<ListSummary[]>("/lists/me", withToken(token, { cache: "no-store" }));
      const mineArr = Array.isArray(mine) ? mine : [];
      setLists(mineArr);

      const owned = mineArr.find((l) => String(l.system_key ?? "").toLowerCase() === "owned");
      const wish = mineArr.find((l) => String(l.system_key ?? "").toLowerCase() === "wishlist");

      const [ownedD, wishD] = await Promise.all([
        owned
          ? apiFetch<ListDetail>(
              `/lists/${encodeURIComponent(String(owned.id))}`,
              withToken(token, { cache: "no-store" })
            )
          : Promise.resolve(null),
        wish
          ? apiFetch<ListDetail>(
              `/lists/${encodeURIComponent(String(wish.id))}`,
              withToken(token, { cache: "no-store" })
            )
          : Promise.resolve(null),
      ]);

      setOwnedDetail(ownedD);
      setWishlistDetail(wishD);

      const ownedNums = toSetNums(ownedD).slice(0, PREVIEW_COUNT);
      const wishNums = toSetNums(wishD).slice(0, PREVIEW_COUNT);

      const [ownedSets, wishSets] = await Promise.all([
        fetchSetsBulk(ownedNums, token),
        fetchSetsBulk(wishNums, token),
      ]);

      setOwnedPreview(ownedSets);
      setWishlistPreview(wishSets);

      const customOnly = mineArr.filter((l) => !isSystemList(l));

      const entries = await Promise.all(
        customOnly.map(async (l): Promise<{ id: string; sets: CardSetLite[] }> => {
          const id = String(l.id);

          try {
            const d = await apiFetch<ListDetail>(
              `/lists/${encodeURIComponent(id)}`,
              withToken(token, { cache: "no-store" })
            );

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

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Owned, Wishlist, and your custom lists.
        </p>

        <div className="mt-5 max-w-xl">
          <QuickCollectionsAdd onCollectionsChanged={refreshAll} />
        </div>
      </div>

      {loading ? <p className="mt-6 text-sm">Loading…</p> : null}
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