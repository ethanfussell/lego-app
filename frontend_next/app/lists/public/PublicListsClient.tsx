// frontend_next/app/lists/public/PublicListsClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isRecord, type UnknownRecord } from "@/lib/types";

type PublicListRow = {
  id: string | number;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  owner?: string | null;
  username?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  items_count?: number | null;
  set_count?: number | null;
  item_count?: number | null;
};

type SortKey = "updated_desc" | "name_asc" | "count_desc";

function pickOwner(r: PublicListRow) {
  return String(r.owner ?? r.username ?? "").trim();
}

function pickCount(r: PublicListRow) {
  const a = typeof r.items_count === "number" ? r.items_count : null;
  const b = typeof r.set_count === "number" ? r.set_count : null;
  const c = typeof r.item_count === "number" ? r.item_count : null;
  return Math.max(0, Math.floor(a ?? b ?? c ?? 0));
}

function pickUpdatedTs(r: PublicListRow) {
  const s = String(r.updated_at ?? r.created_at ?? "").trim();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function formatUpdated(r: PublicListRow): string | null {
  const s = String(r.updated_at ?? r.created_at ?? "").trim();
  if (!s) return null;

  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;

  try {
    return new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

function sortLists(rows: PublicListRow[], sort: SortKey) {
  const copy = [...rows];

  if (sort === "name_asc") {
    copy.sort((a, b) =>
      String(a.title ?? a.name ?? "").localeCompare(String(b.title ?? b.name ?? ""), undefined, { sensitivity: "base" })
    );
    return copy;
  }

  if (sort === "count_desc") {
    copy.sort(
      (a, b) =>
        pickCount(b) - pickCount(a) ||
        String(a.title ?? a.name ?? "").localeCompare(String(b.title ?? b.name ?? ""), undefined, { sensitivity: "base" })
    );
    return copy;
  }

  // updated_desc
  copy.sort((a, b) => pickUpdatedTs(b) - pickUpdatedTs(a) || pickCount(b) - pickCount(a));
  return copy;
}

function isSortKey(x: unknown): x is SortKey {
  return x === "updated_desc" || x === "count_desc" || x === "name_asc";
}

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function coerceRow(x: unknown): PublicListRow | null {
  if (!isRecord(x)) return null;

  const id = x.id;
  if (typeof id !== "string" && typeof id !== "number") return null;

  // Accept common fields; keep optional so UI can render safely
  const row: PublicListRow = {
    id,
    title: typeof x.title === "string" ? x.title : x.title == null ? null : String(x.title),
    name: typeof x.name === "string" ? x.name : x.name == null ? null : String(x.name),
    description:
      typeof x.description === "string" ? x.description : x.description == null ? null : String(x.description),
    owner: typeof x.owner === "string" ? x.owner : x.owner == null ? null : String(x.owner),
    username: typeof x.username === "string" ? x.username : x.username == null ? null : String(x.username),
    updated_at: typeof x.updated_at === "string" ? x.updated_at : x.updated_at == null ? null : String(x.updated_at),
    created_at: typeof x.created_at === "string" ? x.created_at : x.created_at == null ? null : String(x.created_at),
    items_count: typeof x.items_count === "number" && Number.isFinite(x.items_count) ? x.items_count : null,
    set_count: typeof x.set_count === "number" && Number.isFinite(x.set_count) ? x.set_count : null,
    item_count: typeof x.item_count === "number" && Number.isFinite(x.item_count) ? x.item_count : null,
  };

  return row;
}

function toRows(data: unknown): PublicListRow[] {
  if (Array.isArray(data)) {
    return data.map(coerceRow).filter((x): x is PublicListRow => Boolean(x));
  }

  if (isRecord(data) && Array.isArray(data.results)) {
    return (data.results as unknown[]).map(coerceRow).filter((x): x is PublicListRow => Boolean(x));
  }

  return [];
}

// Clickable card without nested <a> inside <a>
function ClickCard({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div
      role="link"
      tabIndex={0}
      className={className}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </div>
  );
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
  const { initialOwner, initialQ, initialSort, initialPage, initialTotalPages, initialLists, initialError } = props;

  const router = useRouter();
  const sp = useSearchParams();

  const [owner, setOwner] = useState(initialOwner);
  const [q, setQ] = useState(initialQ);
  const [sort, setSort] = useState<SortKey>(initialSort);

  const [page, setPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(initialTotalPages);

  const [lists, setLists] = useState<PublicListRow[]>(initialLists);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(initialError);

  const canonical = useMemo(() => {
    const ownerQ = (sp.get("owner") ?? "").trim();
    const qq = (sp.get("q") ?? "").trim();
    const sortRaw = (sp.get("sort") ?? "updated_desc").trim();
    const s: SortKey = isSortKey(sortRaw) ? sortRaw : "updated_desc";

    const pRaw = (sp.get("page") ?? "1").trim();
    const p = Math.max(1, toInt(pRaw, 1));

    return { owner: ownerQ, q: qq, sort: s, page: p };
  }, [sp]);

  // keep inputs in sync on back/forward
  useEffect(() => {
    if (canonical.owner !== owner) setOwner(canonical.owner);
    if (canonical.q !== q) setQ(canonical.q);
    if (canonical.sort !== sort) setSort(canonical.sort);
    if (canonical.page !== page) setPage(canonical.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical.owner, canonical.q, canonical.sort, canonical.page]);

  function pushToUrl(next: { owner: string; q: string; sort: SortKey; page: number }) {
    const params = new URLSearchParams(sp?.toString?.() || "");

    const o = next.owner.trim();
    const qq = next.q.trim();

    if (!o) params.delete("owner");
    else params.set("owner", o);

    if (!qq) params.delete("q");
    else params.set("q", qq);

    if (next.sort === "updated_desc") params.delete("sort");
    else params.set("sort", next.sort);

    if (next.page <= 1) params.delete("page");
    else params.set("page", String(next.page));

    const qs = params.toString();
    router.push(qs ? `/lists/public?${qs}` : `/lists/public`, { scroll: false });
  }

  // fetch when canonical query changes
  useEffect(() => {
    const controller = new AbortController();

    // If canonical matches SSR props, skip refetch
    if (
      canonical.owner === initialOwner &&
      canonical.q === initialQ &&
      canonical.sort === initialSort &&
      canonical.page === initialPage
    ) {
      return () => controller.abort();
    }

    (async () => {
      try {
        setLoading(true);
        setWarning(null);

        const qs = new URLSearchParams();
        if (canonical.owner) qs.set("owner", canonical.owner);
        if (canonical.q) qs.set("q", canonical.q);
        if (canonical.sort !== "updated_desc") qs.set("sort", canonical.sort);
        if (canonical.page > 1) qs.set("page", String(canonical.page));

        const url = `/api/lists/public${qs.toString() ? `?${qs.toString()}` : ""}`;
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });

        if (!res.ok) {
          setWarning(`Couldn’t refresh right now (HTTP ${res.status}). Showing cached results.`);
          return;
        }

        const data: unknown = await res.json().catch(() => null);

        const rows = toRows(data);

        const tp =
          isRecord(data) && typeof data.total_pages === "number" && Number.isFinite(data.total_pages)
            ? Math.max(1, Math.floor(data.total_pages))
            : 1;

        const pg =
          isRecord(data) && typeof data.page === "number" && Number.isFinite(data.page)
            ? Math.max(1, Math.floor(data.page))
            : canonical.page;

        setTotalPages(tp);
        setPage(pg);
        setLists(rows);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setWarning("Couldn’t refresh right now. Showing cached results.");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical.owner, canonical.q, canonical.sort, canonical.page]);

  const sorted = useMemo(() => sortLists(lists, sort), [lists, sort]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold">Public lists</h1>
            <p className="mt-2 text-sm text-zinc-500">Browse lists shared by the community.</p>
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
              pushToUrl({ owner, q, sort, page: 1 });
            }}
          >
            <div className="w-full">
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Filter by owner</label>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. ethan"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="w-full">
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. star wars"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <button
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              type="submit"
            >
              Apply
            </button>

            <button
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              type="button"
              onClick={() => {
                setOwner("");
                setQ("");
                pushToUrl({ owner: "", q: "", sort, page: 1 });
              }}
            >
              Clear
            </button>
          </form>

          <div className="min-w-[220px]">
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Sort</label>
            <select
              value={sort}
              onChange={(e) => {
                const next = (isSortKey(e.target.value) ? e.target.value : "updated_desc") as SortKey;
                setSort(next);
                pushToUrl({ owner: canonical.owner, q: canonical.q, sort: next, page: 1 });
              }}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700"
            >
              <option value="updated_desc">Recently updated</option>
              <option value="count_desc">Most sets</option>
              <option value="name_asc">Name (A → Z)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {loading ? <span className="text-zinc-500">Refreshing…</span> : null}
          {warning ? <span className="text-xs text-zinc-500">{warning}</span> : null}
        </div>

        {sorted.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-500">No public lists found.</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((r) => {
                const id = String(r.id);
                const title = String(r.title ?? r.name ?? "Untitled list");
                const ownerName = pickOwner(r);
                const count = pickCount(r);
                const updated = formatUpdated(r);

                const href = `/lists/${encodeURIComponent(id)}`;
                const ownerHref = ownerName ? `/users/${encodeURIComponent(ownerName)}` : null;

                return (
                  <ClickCard
                    key={id}
                    href={href}
                    className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900">{title}</div>

                        <div className="mt-1 text-xs text-zinc-500">
                          {ownerHref ? (
                            <>
                              by{" "}
                              <Link
                                href={ownerHref}
                                className="font-semibold hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {ownerName}
                              </Link>
                            </>
                          ) : (
                            <>
                              by <span className="font-semibold">{ownerName || "unknown"}</span>
                            </>
                          )}

                          {updated ? <span className="ml-2">• Updated {updated}</span> : null}
                        </div>
                      </div>

                      <div className="shrink-0 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
                        {count} {count === 1 ? "set" : "sets"}
                      </div>
                    </div>

                    {r.description ? (
                      <p className="mt-3 line-clamp-3 text-sm text-zinc-500">
                        {String(r.description)}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-zinc-500">View list →</p>
                    )}
                  </ClickCard>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() =>
                  pushToUrl({
                    owner: canonical.owner,
                    q: canonical.q,
                    sort: canonical.sort,
                    page: Math.max(1, page - 1),
                  })
                }
                className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                ← Prev
              </button>

              <div className="text-sm text-zinc-500">
                Page <span className="font-semibold">{page}</span> of{" "}
                <span className="font-semibold">{Math.max(1, totalPages)}</span>
              </div>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() =>
                  pushToUrl({
                    owner: canonical.owner,
                    q: canonical.q,
                    sort: canonical.sort,
                    page: Math.min(totalPages, page + 1),
                  })
                }
                className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
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