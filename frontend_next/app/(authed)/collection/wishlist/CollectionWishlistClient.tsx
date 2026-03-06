// frontend_next/app/(authed)/collection/wishlist/CollectionWishlistClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard, { type SetLite as SetCardSetLite } from "@/app/components/SetCard";
import AddToListMenu from "@/app/components/AddToListMenu";
import { useToast } from "@/app/ui-providers/ToastProvider";
import { SetGridSkeleton } from "@/app/components/Skeletons";
import EmptyState from "@/app/components/EmptyState";
import ErrorState from "@/app/components/ErrorState";

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

function exportCsv(sets: SetCardSetLite[], filename: string) {
  const header = "Set Number,Name,Year,Pieces,Theme\n";
  const rows = sets
    .map((s) =>
      [
        s.set_num,
        `"${(s.name || "").replace(/"/g, '""')}"`,
        s.year ?? "",
        s.num_parts ?? s.pieces ?? "",
        `"${(s.theme || "").replace(/"/g, '""')}"`,
      ].join(",")
    )
    .join("\n");

  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CollectionWishlistClient() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [wishlistDetail, setWishlistDetail] = useState<WishlistDetail | null>(null);
  const [sets, setSets] = useState<SetCardSetLite[]>([]);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
        toast.push("Set removed from wishlist", { type: "success" });
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
      <div className="flex flex-wrap items-baseline justify-between gap-4 pt-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wishlist</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {wishlistDetail?.items_count ? `${wishlistDetail.items_count} sets` : "Sets you want to get."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded-lg p-1.5 transition-colors ${viewMode === "grid" ? "bg-amber-100 text-amber-600" : "text-zinc-400 hover:bg-zinc-100"}`}
            aria-label="Grid view"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-lg p-1.5 transition-colors ${viewMode === "list" ? "bg-amber-100 text-amber-600" : "text-zinc-400 hover:bg-zinc-100"}`}
            aria-label="List view"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {sets.length > 0 ? (
            <button
              type="button"
              onClick={() => exportCsv(sets, `bricktrack-wishlist-${new Date().toISOString().slice(0, 10)}.csv`)}
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              Export CSV
            </button>
          ) : null}

          <Link
            href="/collection"
            className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold hover:bg-zinc-100"
          >
            Back
          </Link>
        </div>
      </div>

      {loading ? <SetGridSkeleton count={8} /> : null}
      {err ? <ErrorState message={err} onRetry={() => void refresh()} /> : null}

      {sets.length === 0 && !loading ? (
        <EmptyState
          title="No sets on your wishlist"
          description="Save sets you want to buy"
          action={{ href: "/search", label: "Browse sets" }}
        />
      ) : viewMode === "list" ? (
        <div className="mt-6 space-y-2">
          {sets.map((s) => {
            const plain = toPlain(s.set_num);
            const pcs = s.num_parts ?? s.pieces;
            return (
              <div key={s.set_num} className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="h-16 w-16 shrink-0 rounded-lg bg-zinc-100 overflow-hidden">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name || s.set_num} className="h-full w-full object-contain p-1" loading="lazy" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/sets/${encodeURIComponent(s.set_num)}`} className="text-sm font-semibold text-zinc-900 hover:text-amber-600 truncate block">
                    {s.name || s.set_num}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {s.set_num}
                    {s.year ? ` · ${s.year}` : ""}
                    {pcs ? ` · ${pcs} pcs` : ""}
                    {s.theme ? ` · ${s.theme}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeWishlist(s.set_num)}
                  disabled={!!removing[plain]}
                  className="shrink-0 rounded-full border border-red-200 bg-transparent px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {removing[plain] ? "Removing…" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
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
                  className="w-full rounded-full border border-red-200 bg-transparent px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
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