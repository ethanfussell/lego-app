// frontend_next/app/(authed)/collection/wishlist/CollectionWishlistClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard from "@/app/components/SetCard";
import AddToListMenu from "@/app/components/AddToListMenu";

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  num_parts?: number;
  pieces?: number; // backend sometimes uses pieces
  image_url?: string | null;
  theme?: string;
};

type WishlistDetail = {
  items_count: number;
};

function errorMessage(e: unknown, fallback = "Something went wrong") {
  return e instanceof Error ? e.message : String(e || fallback);
}

function toPlain(n: string): string {
  return n.replace(/-\d+$/, "");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceSetLite(raw: unknown): SetLite | null {
  if (!isRecord(raw)) return null;

  const sn = typeof (raw as any).set_num === "string" ? String((raw as any).set_num).trim() : "";
  if (!sn) return null;

  const o: any = raw;

  return {
    set_num: sn,
    ...(typeof o.name === "string" ? { name: o.name } : {}),
    ...(typeof o.year === "number" ? { year: o.year } : {}),
    ...(typeof o.num_parts === "number" ? { num_parts: o.num_parts } : {}),
    ...(typeof o.pieces === "number" ? { pieces: o.pieces } : {}),
    image_url: typeof o.image_url === "string" ? o.image_url : null,
    ...(typeof o.theme === "string" ? { theme: o.theme } : {}),
  };
}

export default function CollectionWishlistClient() {
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [wishlistDetail, setWishlistDetail] = useState<WishlistDetail | null>(null);
  const [sets, setSets] = useState<SetLite[]>([]);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});

  // ✅ selection should be based on what we actually loaded, not on /lists/:id
  const wishlistSetNums = useMemo(() => new Set(sets.map((s) => String(s.set_num).trim())), [sets]);

  const refresh = useCallback(async () => {
    if (!token) return;

    const data = await apiFetch<unknown>("/collections/me/wishlist", { token, cache: "no-store" });
    const rows = Array.isArray(data) ? (data as unknown[]) : [];

    const parsed = rows.map(coerceSetLite).filter((x): x is SetLite => Boolean(x));

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
      <div className="pt-10 flex items-baseline justify-between gap-4">
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
                  set={s as unknown as React.ComponentProps<typeof SetCard>["set"]}
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