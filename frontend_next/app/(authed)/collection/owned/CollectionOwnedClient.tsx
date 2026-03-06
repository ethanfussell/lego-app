// frontend_next/app/(authed)/collection/owned/CollectionOwnedClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useToast } from "@/app/ui-providers/ToastProvider";
import { SetGridSkeleton } from "@/app/components/Skeletons";
import EmptyState from "@/app/components/EmptyState";
import ErrorState from "@/app/components/ErrorState";

/* -- Collection Stats ---------------------------------------- */

function CollectionStats({ sets }: { sets: SetLite[] }) {
  const stats = useMemo(() => {
    const totalPieces = sets.reduce((sum, s) => sum + (s.num_parts ?? 0), 0);
    const themeCounts = new Map<string, number>();
    for (const s of sets) {
      const t = s.theme || "Unknown";
      themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
    }
    const topThemes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { totalPieces, topThemes };
  }, [sets]);

  if (sets.length === 0) return null;

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
        <div className="text-2xl font-bold text-amber-600">{sets.length}</div>
        <div className="mt-1 text-xs text-zinc-500">Total sets</div>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
        <div className="text-2xl font-bold text-amber-600">{stats.totalPieces.toLocaleString()}</div>
        <div className="mt-1 text-xs text-zinc-500">Total pieces</div>
      </div>
      <div className="col-span-2 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-700 mb-2">Top themes</div>
        <div className="space-y-1">
          {stats.topThemes.map(([theme, count]) => (
            <div key={theme} className="flex items-center justify-between text-sm">
              <span className="truncate text-zinc-600">{theme}</span>
              <span className="shrink-0 font-semibold text-zinc-900">{count}</span>
            </div>
          ))}
          {stats.topThemes.length === 0 && <div className="text-sm text-zinc-500">No themes yet</div>}
        </div>
      </div>
    </div>
  );
}

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

/* -- Bulk Import --------------------------------------------- */

function BulkImport({ token, onComplete }: { token: string; onComplete: () => Promise<void> }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
      >
        Bulk import
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="text-sm font-semibold text-zinc-700">Bulk Import</div>
      <p className="mt-1 text-xs text-zinc-500">
        Enter set numbers separated by commas or new lines (e.g., 10305-1, 42143-1)
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="10305-1, 42143-1, 75192-1"
        className="mt-3 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20"
        rows={4}
        disabled={importing}
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={importing || !input.trim()}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60 transition-colors"
        >
          {importing ? "Importing…" : "Import sets"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setResults(null); }}
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          Cancel
        </button>
      </div>
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
    </div>
  );
}

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  num_parts?: number;
  image_url?: string | null;
  theme?: string;
};

function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof Error ? e.message : String(e ?? fallback);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toPlain(n: string): string {
  return n.replace(/-\d+$/, "");
}

function asSetLiteArray(v: unknown): SetLite[] {
  if (!Array.isArray(v)) return [];
  const out: SetLite[] = [];

  for (const raw of v) {
    if (!isRecord(raw)) continue;

    const set_num = typeof raw.set_num === "string" ? raw.set_num.trim() : "";
    if (!set_num) continue;

    const maybeName = raw.name;
    const maybeYear = raw.year;

    // backend might use num_parts OR pieces; accept either
    const maybeNumParts = raw.num_parts;
    const maybePieces = raw.pieces;

    const maybeTheme = raw.theme;

    const num_parts =
      typeof maybeNumParts === "number"
        ? maybeNumParts
        : typeof maybePieces === "number"
          ? maybePieces
          : undefined;

    // IMPORTANT: with exactOptionalPropertyTypes, do not assign undefined; omit instead
    out.push({
      set_num,
      ...(typeof maybeName === "string" ? { name: maybeName } : {}),
      ...(typeof maybeYear === "number" ? { year: maybeYear } : {}),
      ...(typeof num_parts === "number" ? { num_parts } : {}),
      image_url: typeof raw.image_url === "string" ? raw.image_url : null,
      ...(typeof maybeTheme === "string" ? { theme: maybeTheme } : {}),
    });
  }

  return out;
}

export default function CollectionOwnedClient() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sets, setSets] = useState<SetLite[]>([]);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const refresh = useCallback(async () => {
    if (!token) return;

    const data = await apiFetch<unknown>("/collections/me/owned", { token, cache: "no-store" });
    const arr = asSetLiteArray(data);
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
    [token, refresh]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!token) {
        router.push("/login");
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

  const count = sets.length;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Owned</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {count ? `${count} set${count === 1 ? "" : "s"}` : "Your owned LEGO sets."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Grid/List toggle */}
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

          {/* CSV export */}
          {sets.length > 0 ? (
            <button
              type="button"
              onClick={() => { exportCsv(sets, `bricktrack-owned-${new Date().toISOString().slice(0, 10)}.csv`); toast.push("CSV downloaded", { type: "success" }); }}
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

      {/* Bulk import */}
      {token ? <BulkImport token={token} onComplete={refresh} /> : null}

      {/* Stats dashboard */}
      <CollectionStats sets={sets} />

      {loading ? <SetGridSkeleton count={8} /> : null}
      {err ? <ErrorState message={err} onRetry={() => void refresh()} /> : null}

      {sets.length === 0 && !loading ? (
        <EmptyState
          title="No sets in your collection"
          description="Start tracking the LEGO sets you own"
          action={{ href: "/search", label: "Find sets" }}
        />
      ) : viewMode === "list" ? (
        <div className="mt-6 space-y-2">
          {sets.map((s) => {
            const plain = toPlain(s.set_num);
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
                    {s.num_parts ? ` · ${s.num_parts} pcs` : ""}
                    {s.theme ? ` · ${s.theme}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeOwned(s.set_num)}
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
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 list-none p-0">
          {sets.map((s) => {
            const plain = toPlain(s.set_num);
            return (
              <li key={s.set_num} className="space-y-2">
                <SetCard set={s} variant="owned" footer={token ? <SetCardActions token={token} setNum={s.set_num} /> : null} />

                <button
                  type="button"
                  onClick={() => void removeOwned(s.set_num)}
                  disabled={!!removing[plain]}
                  className="w-full rounded-full border border-red-200 bg-transparent px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {removing[plain] ? "Removing…" : "Remove from owned"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}