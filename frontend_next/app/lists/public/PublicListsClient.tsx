"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type PublicListRow = {
  id: string | number;
  name?: string | null;
  description?: string | null;
  owner?: string | null;
  username?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  set_count?: number | null;
  item_count?: number | null;
  sets?: Array<{ set_num: string }> | string[];
};

type SortKey = "updated_desc" | "name_asc" | "count_desc";

function pickOwner(r: PublicListRow) {
  return String(r.owner ?? r.username ?? "").trim();
}

function pickCount(r: PublicListRow) {
  const a = typeof r.set_count === "number" ? r.set_count : null;
  const b = typeof r.item_count === "number" ? r.item_count : null;
  return (a ?? b ?? 0) | 0;
}

function pickUpdatedTs(r: PublicListRow) {
  const s = String(r.updated_at ?? r.created_at ?? "").trim();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function sortLists(rows: PublicListRow[], sort: SortKey) {
  const copy = [...rows];
  if (sort === "name_asc") {
    copy.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" }));
    return copy;
  }
  if (sort === "count_desc") {
    copy.sort((a, b) => pickCount(b) - pickCount(a) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
    return copy;
  }
  // updated_desc
  copy.sort((a, b) => pickUpdatedTs(b) - pickUpdatedTs(a) || pickCount(b) - pickCount(a));
  return copy;
}

export default function PublicListsClient(props: {
  initialOwner: string;
  initialLists: PublicListRow[];
  initialError: string | null;
}) {
  const { initialOwner, initialLists, initialError } = props;

  const router = useRouter();
  const sp = useSearchParams();

  const [owner, setOwner] = useState(initialOwner);
  const [sort, setSort] = useState<SortKey>("updated_desc");

  const [lists, setLists] = useState<PublicListRow[]>(initialLists);
  const [loading, setLoading] = useState(false);

  // IMPORTANT: don’t wipe out server-rendered content (avoid “soft 404 vibes”)
  const [warning, setWarning] = useState<string | null>(initialError);

  const canonicalQueryOwner = useMemo(() => {
    const raw = (sp.get("owner") ?? "").trim();
    return raw;
  }, [sp]);

  // Keep input in sync if user navigates with back/forward
  useEffect(() => {
    if (canonicalQueryOwner !== owner) setOwner(canonicalQueryOwner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalQueryOwner]);

  function pushOwnerToUrl(nextOwner: string) {
    const params = new URLSearchParams(sp?.toString?.() || "");
    const clean = nextOwner.trim();
    if (!clean) params.delete("owner");
    else params.set("owner", clean);
    const qs = params.toString();
    router.push(qs ? `/lists/public?${qs}` : `/lists/public`, { scroll: false });
  }

  // Fetch when URL owner changes (not on every keystroke)
  useEffect(() => {
    const o = canonicalQueryOwner.trim();
    // If URL matches what server already rendered, skip refetch
    if (o === initialOwner.trim()) return;

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setWarning(null);

        const qs = new URLSearchParams();
        if (o) qs.set("owner", o);

        const url = `/api/lists/public${qs.toString() ? `?${qs.toString()}` : ""}`;
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });

        if (!res.ok) {
          setWarning(`Couldn’t refresh right now (HTTP ${res.status}). Showing cached results.`);
          return;
        }

        const data: unknown = await res.json();
        const rows: PublicListRow[] = Array.isArray(data)
          ? (data as PublicListRow[])
          : typeof data === "object" && data !== null && Array.isArray((data as any).results)
            ? ((data as any).results as PublicListRow[])
            : [];

        if (rows.length > 0 || o) setLists(rows);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setWarning("Couldn’t refresh right now. Showing cached results.");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalQueryOwner]);

  const sorted = useMemo(() => sortLists(lists, sort), [lists, sort]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold">Public lists</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Browse lists shared by the community.
            </p>
          </div>
          <Link href="/discover" className="text-sm font-semibold hover:underline">
            Browse sets →
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <form
            className="flex w-full max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              pushOwnerToUrl(owner);
            }}
          >
            <div className="w-full">
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Filter by owner</label>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. ethanfussell"
                className="w-full rounded-xl border border-black/[.08] bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[.14] dark:bg-black"
              />
            </div>
            <button
              className="h-10 rounded-xl border border-black/[.08] bg-white px-4 text-sm font-semibold hover:bg-zinc-50 dark:border-white/[.14] dark:bg-black dark:hover:bg-zinc-900"
              type="submit"
            >
              Apply
            </button>
            <button
              className="h-10 rounded-xl border border-black/[.08] bg-white px-4 text-sm font-semibold hover:bg-zinc-50 dark:border-white/[.14] dark:bg-black dark:hover:bg-zinc-900"
              type="button"
              onClick={() => {
                setOwner("");
                pushOwnerToUrl("");
              }}
            >
              Clear
            </button>
          </form>

          <div className="min-w-[220px]">
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 w-full rounded-xl border border-black/[.08] bg-white px-3 text-sm font-semibold dark:border-white/[.14] dark:bg-black"
            >
              <option value="updated_desc">Recently updated</option>
              <option value="count_desc">Most items</option>
              <option value="name_asc">Name (A → Z)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {loading ? <span className="text-zinc-500">Refreshing…</span> : null}
          {warning ? <span className="text-xs text-zinc-500">{warning}</span> : null}
        </div>

        {sorted.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">No public lists found.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((r) => {
              const id = String(r.id);
              const title = String(r.name ?? "Untitled list");
              const ownerName = pickOwner(r);
              const count = pickCount(r);

              // Strong internal links: list -> list detail (which should link to sets)
              const href = `/lists/${encodeURIComponent(id)}`;

              return (
                <Link
                  key={id}
                  href={href}
                  className="rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-white/[.14] dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>
                      {ownerName ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          by <span className="font-semibold">{ownerName}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 rounded-full border border-black/[.08] px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-white/[.14] dark:text-zinc-200">
                      {count} items
                    </div>
                  </div>

                  {r.description ? (
                    <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {String(r.description)}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">View list →</p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}