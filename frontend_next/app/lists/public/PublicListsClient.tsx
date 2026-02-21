"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type PublicListRow = {
  id: number;
  title: string;
  description: string | null;
  owner: string;
  items_count: number;
  created_at?: string | null;
  updated_at?: string | null;
  is_public?: boolean;
};

type SortKey = "updated_desc" | "count_desc" | "name_asc";

type ApiResp = {
  results: PublicListRow[];
  total: number;
  total_pages: number;
  page: number;
  limit: number;
  sort: SortKey;
  owner: string;
  q: string;
};

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function fmtDate(s?: string | null) {
  const t = Date.parse(String(s ?? ""));
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function buildUrl(sp: URLSearchParams, next: Partial<{ owner: string; q: string; sort: SortKey; page: number }>) {
  const p = new URLSearchParams(sp.toString());

  const owner = (next.owner ?? p.get("owner") ?? "").trim();
  const q = (next.q ?? p.get("q") ?? "").trim();
  const sort = (next.sort ?? (p.get("sort") as SortKey) ?? "updated_desc") || "updated_desc";
  const page = Number.isFinite(next.page as number) ? String(Math.max(1, Math.floor(next.page as number))) : (p.get("page") ?? "");

  if (owner) p.set("owner", owner);
  else p.delete("owner");

  if (q) p.set("q", q);
  else p.delete("q");

  if (sort && sort !== "updated_desc") p.set("sort", sort);
  else p.delete("sort");

  if (page && page !== "1") p.set("page", page);
  else p.delete("page");

  const qs = p.toString();
  return qs ? `/lists/public?${qs}` : `/lists/public`;
}

export default function PublicListsClient(props: {
  initialOwner: string;
  initialQ: string;
  initialSort: SortKey;
  initialPage: number;
  initialTotalPages: number;
  initialLists: PublicListRow[];
  initialError: string | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [owner, setOwner] = useState(props.initialOwner);
  const [q, setQ] = useState(props.initialQ);
  const [sort, setSort] = useState<SortKey>(props.initialSort);

  const [page, setPage] = useState<number>(props.initialPage);
  const [totalPages, setTotalPages] = useState<number>(props.initialTotalPages);

  const [lists, setLists] = useState<PublicListRow[]>(props.initialLists);
  const [loading, setLoading] = useState(false);

  // don’t wipe content, just show warning
  const [warning, setWarning] = useState<string | null>(props.initialError);

  // Canonical values from URL (back/forward)
  const urlOwner = useMemo(() => (sp.get("owner") ?? "").trim(), [sp]);
  const urlQ = useMemo(() => (sp.get("q") ?? "").trim(), [sp]);
  const urlSort = useMemo(() => ((sp.get("sort") as SortKey) || "updated_desc") as SortKey, [sp]);
  const urlPage = useMemo(() => {
    const n = Number(sp.get("page") ?? "1");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  }, [sp]);

  useEffect(() => {
    setOwner(urlOwner);
    setQ(urlQ);
    setSort(urlSort);
    setPage(urlPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlOwner, urlQ, urlSort, urlPage]);

  // Fetch when URL changes
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setWarning(null);

        const qs = new URLSearchParams();
        if (urlOwner) qs.set("owner", urlOwner);
        if (urlQ) qs.set("q", urlQ);
        if (urlSort && urlSort !== "updated_desc") qs.set("sort", urlSort);
        if (urlPage > 1) qs.set("page", String(urlPage));

        const res = await fetch(`/api/lists/public${qs.toString() ? `?${qs.toString()}` : ""}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!res.ok) {
          setWarning(`Couldn’t refresh right now (HTTP ${res.status}). Showing cached results.`);
          return;
        }

        const data: ApiResp = await res.json();
        setLists(Array.isArray(data.results) ? data.results : []);
        setTotalPages(Number.isFinite(data.total_pages) ? data.total_pages : 1);
        setPage(Number.isFinite(data.page) ? data.page : urlPage);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setWarning(errorMessage(e) || "Couldn’t refresh right now. Showing cached results.");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [urlOwner, urlQ, urlSort, urlPage]);

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="m-0 text-2xl font-semibold">All public lists</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Filter + sort community lists.
            </p>
          </div>
          <Link href="/discover" className="text-sm font-semibold hover:underline">
            Browse sets →
          </Link>
        </div>

        <form
          className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(buildUrl(new URLSearchParams(sp.toString()), { owner, q, sort, page: 1 }), { scroll: false });
          }}
        >
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Owner</label>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="e.g. ethan"
              className="w-full rounded-xl border border-black/[.08] bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[.14] dark:bg-black"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Search (q)</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. harry, animal, star wars"
              className="w-full rounded-xl border border-black/[.08] bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[.14] dark:bg-black"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Sort</label>
            <select
              value={sort}
              onChange={(e) => {
                const next = e.target.value as SortKey;
                setSort(next);
                router.push(buildUrl(new URLSearchParams(sp.toString()), { sort: next, page: 1 }), { scroll: false });
              }}
              className="h-10 w-full rounded-xl border border-black/[.08] bg-white px-3 text-sm font-semibold dark:border-white/[.14] dark:bg-black"
            >
              <option value="updated_desc">Newest/Recently updated</option>
              <option value="count_desc">Most sets</option>
              <option value="name_asc">Name (A → Z)</option>
            </select>
          </div>

          <div className="sm:col-span-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="h-10 rounded-xl border border-black/[.08] bg-white px-4 text-sm font-semibold hover:bg-zinc-50 dark:border-white/[.14] dark:bg-black dark:hover:bg-zinc-900"
            >
              Apply
            </button>

            <button
              type="button"
              className="h-10 rounded-xl border border-black/[.08] bg-white px-4 text-sm font-semibold hover:bg-zinc-50 dark:border-white/[.14] dark:bg-black dark:hover:bg-zinc-900"
              onClick={() => {
                setOwner("");
                setQ("");
                setSort("updated_desc");
                router.push("/lists/public", { scroll: false });
              }}
            >
              Clear
            </button>

            {loading ? <span className="text-sm text-zinc-500">Refreshing…</span> : null}
            {warning ? <span className="text-xs text-zinc-500">{warning}</span> : null}
          </div>
        </form>

        {lists.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">No public lists found.</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lists.map((r) => {
                const href = `/lists/${encodeURIComponent(String(r.id))}`;
                const updated = fmtDate(r.updated_at || r.created_at);

                return (
                  <Link
                    key={r.id}
                    href={href}
                    className="rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-white/[.14] dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {r.title || "Untitled list"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          by <span className="font-semibold">{r.owner || "unknown"}</span>
                          {updated ? <span className="ml-2">• Updated {updated}</span> : null}
                        </div>
                      </div>

                      <div className="shrink-0 rounded-full border border-black/[.08] px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-white/[.14] dark:text-zinc-200">
                        {r.items_count} {r.items_count === 1 ? "set" : "sets"}
                      </div>
                    </div>

                    {r.description ? (
                      <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {r.description}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-zinc-500">View list →</p>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="mt-10 flex items-center justify-between">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => router.push(buildUrl(new URLSearchParams(sp.toString()), { page: page - 1 }), { scroll: false })}
                className={`rounded-full border border-black/[.12] px-4 py-2 text-sm font-semibold dark:border-white/[.2] ${
                  !hasPrev ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                ← Prev
              </button>

              <div className="text-sm text-zinc-500">
                Page {page} of {totalPages}
              </div>

              <button
                type="button"
                disabled={!hasNext}
                onClick={() => router.push(buildUrl(new URLSearchParams(sp.toString()), { page: page + 1 }), { scroll: false })}
                className={`rounded-full border border-black/[.12] px-4 py-2 text-sm font-semibold dark:border-white/[.2] ${
                  !hasNext ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}