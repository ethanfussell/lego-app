// frontend_next/app/(authed)/collection/owned/CollectionOwnedClient.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import CollectionToolbar from "@/app/components/CollectionToolbar";
import { isRecord, type SetLite } from "@/lib/types";
import { useCollectionFilters, type CollectionSet } from "@/lib/useCollectionFilters";
import { useToast } from "@/app/ui-providers/ToastProvider";
import { SetGridSkeleton } from "@/app/components/Skeletons";
import EmptyState from "@/app/components/EmptyState";
import ErrorState from "@/app/components/ErrorState";

/* -- CSV Export helper --------------------------------------- */

function exportCsv(sets: SetLite[], filename: string) {
  const header = "Set Number,Name,Year,Pieces,Theme\n";
  const rows = sets
    .map((s) =>
      [
        s.set_num,
        `"${(s.name || "").replace(/"/g, '""')}"`,
        s.year ?? "",
        s.num_parts ?? "",
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

/* -- Bulk Import Modal --------------------------------------- */

function BulkImportModal({
  token,
  onComplete,
  onClose,
}: {
  token: string;
  onComplete: () => Promise<void>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [input, setInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ added: string[]; failed: string[] } | null>(null);

  async function handleImport() {
    const nums = input
      .split(/[,\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (nums.length === 0) return;

    setImporting(true);
    setResults(null);
    const added: string[] = [];
    const failed: string[] = [];

    for (const num of nums) {
      try {
        await apiFetch("/collections/owned", { token, method: "POST", body: { set_num: num } });
        added.push(num);
      } catch {
        failed.push(num);
      }
    }

    setResults({ added, failed });
    setImporting(false);
    setInput("");
    await onComplete();
    if (added.length > 0) {
      toast.push(`Imported ${added.length} set(s)`, { type: "success" });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={() => !importing && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold">Bulk Import</div>
        <p className="mt-1 text-sm text-zinc-500">
          Enter set numbers separated by commas or new lines (e.g., 10305-1, 42143-1)
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="10305-1, 42143-1, 75192-1"
          className="mt-3 w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20"
          rows={4}
          disabled={importing}
          autoFocus
        />

        {results ? (
          <div className="mt-3 text-sm">
            {results.added.length > 0 ? (
              <p className="text-emerald-700">
                Added {results.added.length} set{results.added.length === 1 ? "" : "s"}.
              </p>
            ) : null}
            {results.failed.length > 0 ? (
              <p className="text-red-600">Failed: {results.failed.join(", ")}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={importing}
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing || !input.trim()}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60 transition-colors"
          >
            {importing ? "Importing\u2026" : "Import sets"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -- Helpers ------------------------------------------------- */

function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof Error ? e.message : String(e ?? fallback);
}

function toPlain(n: string): string {
  return n.replace(/-\d+$/, "");
}

function asCollectionSetArray(v: unknown): CollectionSet[] {
  if (!Array.isArray(v)) return [];
  const out: CollectionSet[] = [];

  for (const raw of v) {
    if (!isRecord(raw)) continue;

    const set_num = typeof raw.set_num === "string" ? raw.set_num.trim() : "";
    if (!set_num) continue;

    const maybeName = raw.name;
    const maybeYear = raw.year;
    const maybeNumParts = raw.num_parts;
    const maybePieces = raw.pieces;
    const maybeTheme = raw.theme;
    const maybeCollectionCreatedAt = raw.collection_created_at;

    const num_parts =
      typeof maybeNumParts === "number"
        ? maybeNumParts
        : typeof maybePieces === "number"
          ? maybePieces
          : undefined;

    out.push({
      set_num,
      ...(typeof maybeName === "string" ? { name: maybeName } : {}),
      ...(typeof maybeYear === "number" ? { year: maybeYear } : {}),
      ...(typeof num_parts === "number" ? { num_parts } : {}),
      image_url: typeof raw.image_url === "string" ? raw.image_url : null,
      ...(typeof maybeTheme === "string" ? { theme: maybeTheme } : {}),
      ...(typeof maybeCollectionCreatedAt === "string" ? { collection_created_at: maybeCollectionCreatedAt } : {}),
    });
  }

  return out;
}

/* -- Trash Icon ---------------------------------------------- */

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

/* -- Main Component ------------------------------------------ */

export default function CollectionOwnedClient() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sets, setSets] = useState<CollectionSet[]>([]);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showBulkImport, setShowBulkImport] = useState(false);

  const filters = useCollectionFilters(sets);

  const refresh = useCallback(async () => {
    if (!token) return;

    const data = await apiFetch<unknown>("/collections/me/owned", { token, cache: "no-store" });
    const arr = asCollectionSetArray(data);
    setSets(arr);
  }, [token]);

  const removeOwned = useCallback(
    async (setNum: string) => {
      if (!token) return;

      const plain = toPlain(String(setNum || "").trim());
      if (!plain) return;

      try {
        setErr(null);
        setRemoving((m) => ({ ...m, [plain]: true }));

        // optimistic
        setSets((prev) => prev.filter((s) => toPlain(s.set_num) !== plain));

        await apiFetch(`/collections/owned/${encodeURIComponent(plain)}`, {
          token,
          method: "DELETE",
        });

        await refresh();
        toast.push("Set removed from collection", { type: "success" });
      } catch (e: unknown) {
        setErr(errorMessage(e, "Failed to remove from owned"));
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
    let cancelled = false;

    (async () => {
      if (!token) {
        router.push("/sign-in");
        return;
      }

      try {
        setLoading(true);
        setErr(null);
        await refresh();
      } catch (e: unknown) {
        if (!cancelled) setErr(errorMessage(e));
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
          <h1 className="text-2xl font-semibold tracking-tight">Owned</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {sets.length ? `${sets.length} set${sets.length === 1 ? "" : "s"} in your collection` : "Your owned LEGO sets."}
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
              exportCsv(sets, `bricktrack-owned-${new Date().toISOString().slice(0, 10)}.csv`);
              toast.push("CSV downloaded", { type: "success" });
            }}
            onBulkImport={() => setShowBulkImport(true)}
          />
        </div>
      )}

      {/* Bulk import modal */}
      {showBulkImport && token && (
        <BulkImportModal
          token={token}
          onComplete={refresh}
          onClose={() => setShowBulkImport(false)}
        />
      )}

      {loading ? <SetGridSkeleton count={8} /> : null}
      {err ? <ErrorState message={err} onRetry={() => void refresh()} /> : null}

      {sets.length === 0 && !loading ? (
        <EmptyState
          title="No sets in your collection"
          description="Start tracking the LEGO sets you own"
          action={{ href: "/search", label: "Find sets" }}
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
                    {s.num_parts ? ` \u00b7 ${s.num_parts} pcs` : ""}
                    {s.theme ? ` \u00b7 ${s.theme}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeOwned(s.set_num)}
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
                <SetCard set={s} variant="owned" footer={token ? <SetCardActions token={token} setNum={s.set_num} isOwned /> : null} />

                {/* Hover-reveal trash button */}
                <button
                  type="button"
                  onClick={() => void removeOwned(s.set_num)}
                  disabled={!!removing[plain]}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-zinc-400 opacity-0 shadow-sm backdrop-blur transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-60"
                  aria-label="Remove from collection"
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
