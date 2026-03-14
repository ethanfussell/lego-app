// frontend_next/app/(authed)/collection/wishlist/CollectionWishlistClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard, { type SetLite as SetCardSetLite } from "@/app/components/SetCard";
import AddToListMenu from "@/app/components/AddToListMenu";
import CollectionToolbar from "@/app/components/CollectionToolbar";
import { asFiniteNumber, asTrimmedString, isRecord } from "@/lib/types";
import { useCollectionFilters, type CollectionSet } from "@/lib/useCollectionFilters";
import { useToast } from "@/app/ui-providers/ToastProvider";
import { SetGridSkeleton } from "@/app/components/Skeletons";
import EmptyState from "@/app/components/EmptyState";
import ErrorState from "@/app/components/ErrorState";

function errorMessage(e: unknown, fallback = "Something went wrong") {
  return e instanceof Error ? e.message : String(e ?? fallback);
}

function toPlain(n: string): string {
  return n.replace(/-\d+$/, "");
}

function coerceCollectionSet(raw: unknown): CollectionSet | null {
  if (!isRecord(raw)) return null;

  const set_num = asTrimmedString(raw.set_num);
  if (!set_num) return null;

  const name = asTrimmedString(raw.name) ?? undefined;
  const year = asFiniteNumber(raw.year) ?? undefined;

  const num_parts =
    asFiniteNumber(raw.num_parts) ??
    asFiniteNumber(raw.pieces) ??
    null;

  const theme = asTrimmedString(raw.theme) ?? undefined;
  const image_url = asTrimmedString(raw.image_url);

  const pieces =
    asFiniteNumber(raw.pieces) ??
    (num_parts != null ? num_parts : null);

  const rating_avg = asFiniteNumber(raw.rating_avg);
  const rating_count = asFiniteNumber(raw.rating_count);
  const collection_created_at = asTrimmedString(raw.collection_created_at);

  return {
    set_num,
    ...(name ? { name } : {}),
    ...(typeof year === "number" ? { year } : {}),
    ...(typeof pieces === "number" ? { pieces } : {}),
    ...(typeof num_parts === "number" ? { num_parts } : {}),
    ...(theme ? { theme } : {}),
    image_url: image_url ?? null,
    ...(typeof rating_avg === "number" ? { rating_avg } : {}),
    ...(typeof rating_count === "number" ? { rating_count } : {}),
    ...(collection_created_at ? { collection_created_at } : {}),
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

/* -- Trash Icon ---------------------------------------------- */

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

export default function CollectionWishlistClient() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sets, setSets] = useState<CollectionSet[]>([]);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const wishlistSetNums = useMemo(() => new Set(sets.map((s) => String(s.set_num).trim())), [sets]);

  const filters = useCollectionFilters(sets);

  const refresh = useCallback(async () => {
    if (!token) return;

    const data = await apiFetch<unknown>("/collections/me/wishlist", { token, cache: "no-store" });
    const rows = Array.isArray(data) ? data : [];

    const parsed = rows.map(coerceCollectionSet).filter((x): x is CollectionSet => x != null);

    setSets(parsed);
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
    [token, refresh, toast]
  );

  useEffect(() => {
    if (!token) {
      router.push("/sign-in");
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
      {/* Header with back arrow */}
      <div className="flex items-center gap-3 pt-8">
        <Link
          href="/collection"
          className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          aria-label="Back to collection"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wishlist</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {sets.length ? `${sets.length} set${sets.length === 1 ? "" : "s"} you want` : "Sets you want to get."}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      {!loading && sets.length > 0 && (
        <div className="mt-4">
          <CollectionToolbar
            search={filters.search}
            onSearchChange={filters.setSearch}
            sortKey={filters.sortKey}
            sortDir={filters.sortDir}
            onSortChange={(key, dir) => { filters.setSortKey(key); filters.setSortDir(dir); }}
            availableThemes={filters.availableThemes}
            selectedThemes={filters.selectedThemes}
            onToggleTheme={filters.toggleTheme}
            hasActiveFilters={filters.hasActiveFilters}
            activeFilterCount={filters.activeFilterCount}
            onClearFilters={filters.clearFilters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            totalCount={filters.totalCount}
            filteredCount={filters.filteredCount}
            onExportCsv={() => {
              exportCsv(sets, `bricktrack-wishlist-${new Date().toISOString().slice(0, 10)}.csv`);
              toast.push("CSV downloaded", { type: "success" });
            }}
          />
        </div>
      )}

      {loading ? <SetGridSkeleton count={8} /> : null}
      {err ? <ErrorState message={err} onRetry={() => void refresh()} /> : null}

      {sets.length === 0 && !loading ? (
        <EmptyState
          title="No sets on your wishlist"
          description="Save sets you want to buy"
          action={{ href: "/search", label: "Browse sets" }}
        />
      ) : filters.filtered.length === 0 && !loading && sets.length > 0 ? (
        <div className="mt-12 text-center">
          <p className="text-sm text-zinc-500">No sets match your filters.</p>
          <button
            type="button"
            onClick={() => { filters.clearFilters(); filters.setSearch(""); }}
            className="mt-2 text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            Clear all filters
          </button>
        </div>
      ) : viewMode === "list" ? (
        <div className="mt-6 space-y-2">
          {filters.filtered.map((s) => {
            const plain = toPlain(s.set_num);
            const pcs = s.num_parts ?? s.pieces;
            return (
              <div key={s.set_num} className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name || s.set_num} className="h-full w-full object-contain p-1" loading="lazy" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/sets/${encodeURIComponent(s.set_num)}`} className="block truncate text-sm font-semibold text-zinc-900 hover:text-amber-600">
                    {s.name || s.set_num}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {s.set_num}
                    {s.year ? ` \u00b7 ${s.year}` : ""}
                    {pcs ? ` \u00b7 ${pcs} pcs` : ""}
                    {s.theme ? ` \u00b7 ${s.theme}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeWishlist(s.set_num)}
                  disabled={!!removing[plain]}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                >
                  {removing[plain] ? "Removing\u2026" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="mt-6 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {filters.filtered.map((s) => {
            const plain = toPlain(s.set_num);
            return (
              <li key={s.set_num} className="group relative">
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

                {/* Hover-reveal trash button */}
                <button
                  type="button"
                  onClick={() => void removeWishlist(s.set_num)}
                  disabled={!!removing[plain]}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-zinc-400 opacity-0 shadow-sm backdrop-blur transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-60"
                  aria-label="Remove from wishlist"
                >
                  <TrashIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
