// lib/useCollectionStatus.ts
// Shared hook — fetches the logged-in user's owned / wishlist set_nums once,
// then exposes simple `isOwned(setNum)` / `isWishlist(setNum)` helpers.
// Call `notifyCollectionChanged()` from any mutation point (add/remove/rate)
// to trigger a re-fetch across all mounted consumers.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";

type CollectionRow = { set_num: string };

const COLLECTION_CHANGED = "collection-changed";

/**
 * Dispatch this after any mutation that changes the user's owned/wishlist
 * collections (add, remove, rate, review). Every mounted useCollectionStatus
 * instance will re-fetch automatically.
 */
export function notifyCollectionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COLLECTION_CHANGED));
  }
}

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
  const [refreshKey, setRefreshKey] = useState(0);

  /** Manually trigger a re-fetch (same as notifyCollectionChanged but local). */
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Listen for global collection-changed events from other components
  useEffect(() => {
    function onChanged() {
      setRefreshKey((k) => k + 1);
    }
    window.addEventListener(COLLECTION_CHANGED, onChanged);
    return () => window.removeEventListener(COLLECTION_CHANGED, onChanged);
  }, []);

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
  }, [token, hydrated, refreshKey]);

  const helpers = useMemo(
    () => ({
      ownedSetNums,
      wishlistSetNums,
      loading,
      refresh,
      isOwned: (setNum: string) => ownedSetNums.has(setNum),
      isWishlist: (setNum: string) => !ownedSetNums.has(setNum) && wishlistSetNums.has(setNum),
    }),
    [ownedSetNums, wishlistSetNums, loading, refresh],
  );

  return helpers;
}
