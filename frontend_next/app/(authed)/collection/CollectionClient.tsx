"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard from "@/app/components/SetCard";
import AddToListMenu from "@/app/components/AddToListMenu";
import QuickCollectionsAdd from "@/app/components/QuickCollectionsAdd"; // ✅ add this

const PREVIEW_COUNT = 10;

// ...rest of your file unchanged...

export default function CollectionClient() {
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ...state + memos unchanged...

  async function refreshAll() {
    if (!token) return;

    // (unchanged)
    const mine = await apiFetch<ListSummary[]>("/lists/me", { token });
    const mineArr = Array.isArray(mine) ? mine : [];
    setLists(mineArr);

    const owned = mineArr.find((l) => String(l.system_key).toLowerCase() === "owned");
    const wish = mineArr.find((l) => String(l.system_key).toLowerCase() === "wishlist");

    const [ownedD, wishD] = await Promise.all([
      owned ? apiFetch<ListDetail>(`/lists/${encodeURIComponent(String(owned.id))}`, { token }) : Promise.resolve(null),
      wish ? apiFetch<ListDetail>(`/lists/${encodeURIComponent(String(wish.id))}`, { token }) : Promise.resolve(null),
    ]);

    setOwnedDetail(ownedD);
    setWishlistDetail(wishD);

    const ownedNums = toSetNums(ownedD).slice(0, PREVIEW_COUNT);
    const wishNums = toSetNums(wishD).slice(0, PREVIEW_COUNT);

    const [ownedSets, wishSets] = await Promise.all([fetchSetsBulk(ownedNums, token), fetchSetsBulk(wishNums, token)]);

    setOwnedPreview(ownedSets);
    setWishlistPreview(wishSets);

    const customOnly = mineArr.filter((l) => !isSystemList(l));
    const entries = await Promise.all(
      customOnly.map(async (l) => {
        try {
          const d = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(String(l.id))}`, { token });
          const nums = toSetNums(d).slice(0, PREVIEW_COUNT);
          const sets = await fetchSetsBulk(nums, token);
          return [String(l.id), sets] as const;
        } catch {
          return [String(l.id), []] as const;
        }
      })
    );

    const map: Record<string, SetLite[]> = {};
    for (const [id, sets] of entries) map[id] = sets;
    setCustomPreviewById(map);
  }

  // ...effects + toggleOwned/toggleWishlist unchanged...

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">My Collection</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Owned, Wishlist, and your custom lists.
        </p>

        {/* ✅ Quick add box */}
        <div className="mt-5 max-w-xl">
          <QuickCollectionsAdd onCollectionsChanged={refreshAll} />
        </div>
      </div>

      {loading && <p className="mt-6 text-sm">Loading…</p>}
      {err && <p className="mt-6 text-sm text-red-600">Error: {err}</p>}

      {/* rows unchanged */}
      <Row
        title="Owned"
        subtitle={ownedDetail?.items_count ? `${ownedDetail.items_count} sets` : undefined}
        sets={ownedPreview}
        href="/collection/owned"
        renderFooter={renderFooterForSet}
      />

      <Row
        title="Wishlist"
        subtitle={wishlistDetail?.items_count ? `${wishlistDetail.items_count} sets` : undefined}
        sets={wishlistPreview}
        href="/collection/wishlist"
        renderFooter={renderFooterForSet}
      />

      {customLists.map((l) => {
        const id = String(l.id);
        const sets = customPreviewById[id] || [];
        const count = l.items_count ?? 0;
        return (
          <Row
            key={id}
            title={l.title || `List ${id}`}
            subtitle={`${l.is_public ? "Public" : "Private"} • ${count} sets`}
            sets={sets}
            href={`/lists/${encodeURIComponent(id)}`}
            renderFooter={renderFooterForSet}
          />
        );
      })}
    </div>
  );
}