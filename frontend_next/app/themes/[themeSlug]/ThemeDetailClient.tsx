"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  theme?: string | null;
  image_url?: string | null;
  rating_count?: number | null;
  rating_avg?: number | null;
  average_rating?: number | null;
};

type Query = {
  page: number;
  limit: number;
  sort: string;
  order: string;
};

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}
function posInt(raw: string, fallback: number) {
  const n = toInt(raw, fallback);
  return n > 0 ? n : fallback;
}

function getClientQueryDefaults(): Query {
  // Must match your server defaults
  return { page: 1, limit: 36, sort: "relevance", order: "desc" };
}

function readQueryFromLocation(): Query {
  const d = getClientQueryDefaults();
  if (typeof window === "undefined") return d;

  const sp = new URLSearchParams(window.location.search);
  const page = posInt(sp.get("page") || "1", 1);
  const limit = posInt(sp.get("limit") || String(d.limit), d.limit);
  const sort = (sp.get("sort") || d.sort).trim() || d.sort;
  const order = (sp.get("order") || d.order).trim() || d.order;

  return { page, limit, sort, order };
}

function sameQuery(a: Query, b: Query) {
  return a.page === b.page && a.limit === b.limit && a.sort === b.sort && a.order === b.order;
}

function toSetSummaryArray(x: unknown): SetSummary[] {
  if (Array.isArray(x)) return x as SetSummary[];
  if (typeof x === "object" && x !== null) {
    const r = (x as any).results;
    return Array.isArray(r) ? (r as SetSummary[]) : [];
  }
  return [];
}

export default function ThemeDetailClient(props: {
  themeSlug: string;
  initialSets: SetSummary[];
  initialQuery: Query;
}) {
  const { themeSlug, initialSets, initialQuery } = props;

  // Start with server-rendered data so bots/users see real content immediately.
  const [sets, setSets] = useState<SetSummary[]>(initialSets);
  const [loading, setLoading] = useState(false);

  // IMPORTANT: This should NOT wipe out the grid (keeps SEO content stable)
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);

  const clientQuery = useMemo(() => readQueryFromLocation(), []);

  useEffect(() => {
    // If the URL query equals what the server rendered, don't immediately refetch.
    // (Avoid Google seeing an error overlay on first render.)
    if (sameQuery(clientQuery, initialQuery)) return;

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setRefreshWarning(null);

        const qs = new URLSearchParams();
        qs.set("page", String(clientQuery.page));
        qs.set("limit", String(clientQuery.limit));
        qs.set("sort", clientQuery.sort);
        qs.set("order", clientQuery.order);

        // Hit your Next route handler (same-origin)
        const url = `/api/themes/${encodeURIComponent(themeSlug)}/sets?${qs.toString()}`;

        const res = await fetch(url, {
          signal: controller.signal,
          // no-store is fine on the client; the key is not to replace the grid with an error
          cache: "no-store",
        });

        if (!res.ok) {
          // Keep existing sets; just show a small warning
          setRefreshWarning(`Couldn’t refresh right now (HTTP ${res.status}). Showing cached results.`);
          return;
        }

        const data: unknown = await res.json();
        const rows = toSetSummaryArray(data);
        if (rows.length > 0) setSets(rows);
      } catch (e: any) {
        // Keep existing sets; just show a small warning
        if (e?.name === "AbortError") return;
        setRefreshWarning("Couldn’t refresh right now. Showing cached results.");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeSlug]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{sets?.[0]?.theme ?? "Theme"}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            {loading ? <span>Refreshing…</span> : <span> </span>}
            {refreshWarning ? (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{refreshWarning}</span>
            ) : null}
          </div>
        </div>

        <Link href="/themes" className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
          ← All themes
        </Link>
      </div>

      {/* Always render the grid if we have any sets */}
      {sets.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => (
            <div key={s.set_num} className="h-full">
              <div className="flex h-full flex-col rounded-2xl border border-black/[.08] bg-white shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
                <Link className="block flex-1" href={`/sets/${encodeURIComponent(s.set_num)}`}>
                  <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-50 dark:bg-white/5">
                    {s.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image_url}
                        alt={s.name}
                        className="h-full w-full object-contain p-4"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="px-4 pb-4 pt-3">
                    <div className="text-sm font-semibold leading-5 text-zinc-900 dark:text-zinc-50">{s.name}</div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                      <span className="truncate">{s.set_num}</span>
                      {s.year ? (
                        <>
                          <span aria-hidden="true">•</span>
                          <span className="shrink-0">{s.year}</span>
                        </>
                      ) : null}
                    </div>
                    {typeof s.pieces === "number" ? (
                      <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{s.pieces} pcs</div>
                    ) : null}
                  </div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No sets found for this theme.</p>
        </div>
      )}
    </div>
  );
}