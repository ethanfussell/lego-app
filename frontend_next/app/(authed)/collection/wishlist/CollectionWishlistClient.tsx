// frontend_next/app/(authed)/collection/wishlist/CollectionWishlistClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard, { type SetLite as SetCardSetLite } from "@/app/components/SetCard";
import AddToListMenu from "@/app/components/AddToListMenu";

type WishlistDetail = {
  items_count: number;
};

function errorMessage(e: unknown, fallback = "Something went wrong") {
  return e instanceof Error ? e.message : String(e ?? fallback);
}

function toPlain(n: string): string {
  return n.replace(/-\d+$/, "");
}

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asTrimmedString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function coerceSetLite(raw: unknown): SetCardSetLite | null {
  if (!isRecord(raw)) return null;

  const set_num = asTrimmedString(raw.set_num);
  if (!set_num) return null;

  const name = asTrimmedString(raw.name) ?? undefined;
  const year = asFiniteNumber(raw.year) ?? undefined;

  // backend might use num_parts OR pieces; accept either
  const num_parts =
    asFiniteNumber(raw.num_parts) ??
    asFiniteNumber(raw.pieces) ??
    null;

  const theme = asTrimmedString(raw.theme) ?? undefined;
  const image_url = asTrimmedString(raw.image_url);

  // Note: SetCard supports pieces OR num_parts; we can pass both if present.
  // Prefer `pieces` when available for UI wording; otherwise fall back to num_parts.
  const pieces =
    asFiniteNumber(raw.pieces) ??
    (num_parts != null ? num_parts : null);

  // Optional pricing/ratings fields (if backend ever sends them)
  const rating_avg = asFiniteNumber(raw.rating_avg);
  const average_rating = asFiniteNumber(raw.average_rating);
  const rating_count = asFiniteNumber(raw.rating_count);

  return {
    set_num,
    ...(name ? { name } : {}),
    ...(typeof year === "number" ? { year } : {}),
    ...(typeof pieces === "number" ? { pieces } : {}),
    ...(typeof num_parts === "number" ? { num_parts } : {}),
    ...(theme ? { theme } : {}),
    image_url: image_url ?? null,
    ...(typeof rating_avg === "number" ? { rating_avg } : {}),
    ...(typeof average_rating === "number" ? { average_rating } : {}),
    ...(typeof rating_count === "number" ? { rating_count } : {}),
  };
}

export default function CollectionWishlistClient() {
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [wishlistDetail, setWishlistDetail] = useState<WishlistDetail | null>(null);
  const [sets, setSets] = useState<SetCardSetLite[]>([]);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});

  // Selection should be based on what we actually loaded
  const wishlistSetNums = useMemo(() => new Set(sets.map((s) => String(s.set_num).trim())), [sets]);

  const refresh = useCallback(async () => {
    if (!token) return;

    const data = await apiFetch<unknown>("/collections/me/wishlist", { token, cache: "no-store" });
    const rows = Array.isArray(data) ? data : [];

    const parsed = rows.map(coerceSetLite).filter((x): x is SetCardSetLite => x != null);

    setSets(parsed);
    setWishlistDetail({ items_count: parsed.length });
  }, [token]);

  const removeWishlist = useCallback(
    async (setNum: string) => {
      if (!token) return;

      const plain = toPlain(String(setNum || "").trim());
      if (!plain) return;

      try {
        setErr(null);
        setRemoving((m) => ({ ...m, [plain]: true }));

        // optimistic
        setSets((prev) => prev.filter((s) => toPlain(s.set_num) !== plain));

        await apiFetch(`/collections/wishlist/${encodeURIComponent(plain)}`, {
          token,
          method: "DELETE",
        });

        await refresh();
      } catch (e: unknown) {
        setErr(errorMessage(e, "Failed to remove from wishlist"));
        await refresh();
      } finally {
        setRemoving((m) => {
          const next = { ...m };
          delete next[plain];
          return next;
        });
      }
    },
    [token, refresh]
  );

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        await refresh();
      } catch (e: unknown) {
        if (!cancelled) setErr(errorMessage(e, "Failed to load wishlist"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router, refresh]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="flex items-baseline justify-between gap-4 pt-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wishlist</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {wishlistDetail?.items_count ? `${wishlistDetail.items_count} sets` : "Sets you want to get."}
          </p>
        </div>

        <Link
          href="/collection"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
        >
          Back
        </Link>
      </div>

      {loading ? <p className="mt-6 text-sm">Loading…</p> : null}
      {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      {sets.length === 0 && !loading ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No sets yet.</p>
      ) : (
        <ul className="mt-6 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {sets.map((s) => {
            const plain = toPlain(s.set_num);
            return (
              <li key={s.set_num} className="space-y-2">
                <SetCard
                  set={s}
                  variant="wishlist"
                  footer={
                    token ? (
                      <AddToListMenu
                        token={token}
                        setNum={s.set_num}
                        initialWishlistSelected={wishlistSetNums.has(s.set_num)}
                      />
                    ) : null
                  }
                />

                <button
                  type="button"
                  onClick={() => void removeWishlist(s.set_num)}
                  disabled={!!removing[plain]}
                  className="w-full rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/20"
                >
                  {removing[plain] ? "Removing…" : "Remove from wishlist"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}