// lib/useCollectionStatus.ts
// Shared hook — fetches the logged-in user's owned / wishlist set_nums once,
// then exposes simple `isOwned(setNum)` / `isWishlist(setNum)` helpers.
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";

type CollectionRow = { set_num: string };

function isCollectionRow(x: unknown): x is CollectionRow {
  return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
}

function toSetNums(raw: unknown): Set<string> {
  const rows = Array.isArray(raw) ? raw.filter(isCollectionRow) : [];
  return new Set(rows.map((r) => String(r.set_num || "").trim()).filter(Boolean));
}

export function useCollectionStatus() {
  const { token, hydrated } = useAuth();

  const [ownedSetNums, setOwnedSetNums] = useState<Set<string>>(new Set());
  const [wishlistSetNums, setWishlistSetNums] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hydrated) return;
      if (!token) {
        setOwnedSetNums(new Set());
        setWishlistSetNums(new Set());
        return;
      }

      setLoading(true);
      try {
        const [owned, wish] = await Promise.all([
          apiFetch<unknown>("/collections/me/owned", { token, cache: "no-store" }),
          apiFetch<unknown>("/collections/me/wishlist", { token, cache: "no-store" }),
        ]);
        if (cancelled) return;
        setOwnedSetNums(toSetNums(owned));
        setWishlistSetNums(toSetNums(wish));
      } catch {
        if (cancelled) return;
        setOwnedSetNums(new Set());
        setWishlistSetNums(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [token, hydrated]);

  const helpers = useMemo(
    () => ({
      ownedSetNums,
      wishlistSetNums,
      loading,
      isOwned: (setNum: string) => ownedSetNums.has(setNum),
      isWishlist: (setNum: string) => !ownedSetNums.has(setNum) && wishlistSetNums.has(setNum),
    }),
    [ownedSetNums, wishlistSetNums, loading],
  );

  return helpers;
}
