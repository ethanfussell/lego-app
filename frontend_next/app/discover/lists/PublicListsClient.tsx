// frontend_next/app/discover/lists/PublicListsClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type PublicList = {
  id: number | string;

  title?: string | null;
  name?: string | null;
  description?: string | null;

  is_public?: boolean | null;

  owner?: string | null;
  owner_username?: string | null;
  username?: string | null;

  items_count?: number | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type SortKey = "newest" | "most_sets";

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function toTime(v: unknown) {
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? t : 0;
}

function isPublicList(x: unknown): x is PublicList {
  if (typeof x !== "object" || x === null) return false;
  const id = (x as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number";
}

function toPublicListArray(x: unknown): PublicList[] {
  return Array.isArray(x) ? x.filter(isPublicList) : [];
}

function sortPublicLists(arr: PublicList[], sortKey: SortKey): PublicList[] {
  const copy = [...arr];

  if (sortKey === "most_sets") {
    copy.sort((a, b) => {
      const bc = Number(b.items_count ?? 0);
      const ac = Number(a.items_count ?? 0);
      if (bc !== ac) return bc - ac;

      const bt = toTime(b.created_at ?? b.updated_at);
      const at = toTime(a.created_at ?? a.updated_at);
      return bt - at;
    });
    return copy;
  }

  // default: newest
  copy.sort((a, b) => {
    const bt = toTime(b.created_at ?? b.updated_at);
    const at = toTime(a.created_at ?? a.updated_at);
    if (bt !== at) return bt - at;

    const bc = Number(b.items_count ?? 0);
    const ac = Number(a.items_count ?? 0);
    return bc - ac;
  });

  return copy;
}

export default function PublicListsClient() {
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);
  const [lists, setLists] = useState<PublicList[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const data = await apiFetch<unknown>("/lists/public", { cache: "no-store" });
        if (cancelled) return;

        setLists(toPublicListArray(data));
      } catch (e: unknown) {
        if (!cancelled) setErr(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const ordered = useMemo(() => sortPublicLists(lists, sortKey), [lists, sortKey]);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16">
      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold">Public Lists</h1>
          <p className="mt-2 text-sm text-zinc-500">Browse lists created by other LEGO fans.</p>
        </div>

        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Sort{" "}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="ml-2 rounded-lg border border-black/[.10] bg-white px-2 py-1 text-sm dark:border-white/[.14] dark:bg-zinc-950"
          >
            <option value="newest">Newest</option>
            <option value="most_sets">Most sets</option>
          </select>
        </label>
      </div>

      {loading ? <p className="mt-6 text-sm">Loading public lists…</p> : null}
      {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      {!loading && !err && ordered.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No public lists yet.</p>
      ) : null}

      {!loading && !err && ordered.length > 0 ? (
        <ul className="mt-6 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 p-0">
          {ordered.map((l) => {
            const id = l.id;

            const count =
              typeof l.items_count === "number" && Number.isFinite(l.items_count) ? Math.max(0, l.items_count) : 0;

            const owner = (l.owner ?? l.owner_username ?? l.username ?? "").trim() || "unknown";
            const title = (l.title ?? l.name ?? "Untitled list").trim() || "Untitled list";
            const desc = (l.description ?? "").trim();

            return (
              <li
                key={String(id)}
                className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/lists/${encodeURIComponent(String(id))}`}
                      className="font-extrabold leading-tight text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {title}
                    </Link>

                    <div className="mt-2 text-sm text-zinc-500">
                      by <span className="font-semibold">{owner}</span> · Public
                    </div>

                    {desc ? <div className="mt-2 text-sm text-zinc-500">{desc}</div> : null}
                  </div>

                  <span className="shrink-0 whitespace-nowrap rounded-full border border-black/[.08] bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-white/[.14] dark:bg-white/5 dark:text-zinc-300">
                    {count} {count === 1 ? "set" : "sets"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}