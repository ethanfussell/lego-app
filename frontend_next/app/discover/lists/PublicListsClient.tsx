// frontend_next/app/discover/lists/PublicListsClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

function toTime(v: any) {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : 0;
}

function sortPublicLists(arr: any[], sortKey: string) {
  const copy = Array.isArray(arr) ? [...arr] : [];

  if (sortKey === "most_sets") {
    copy.sort((a, b) => {
      const bc = Number(b?.items_count ?? 0);
      const ac = Number(a?.items_count ?? 0);
      if (bc !== ac) return bc - ac;

      const bt = toTime(b?.created_at || b?.updated_at);
      const at = toTime(a?.created_at || a?.updated_at);
      return bt - at;
    });
    return copy;
  }

  // default: newest
  copy.sort((a, b) => {
    const bt = toTime(b?.created_at || b?.updated_at);
    const at = toTime(a?.created_at || a?.updated_at);
    if (bt !== at) return bt - at;

    const bc = Number(b?.items_count ?? 0);
    const ac = Number(a?.items_count ?? 0);
    return bc - ac;
  });

  return copy;
}

export default function PublicListsClient() {
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [sortKey, setSortKey] = useState("newest"); // "newest" | "most_sets"

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        const data = await apiFetch<any>("/lists/public", { cache: "no-store" });
        if (cancelled) return;
        setLists(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message || String(e));
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
            onChange={(e) => setSortKey(e.target.value)}
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
            const id = l?.id;
            if (!id) return null;

            const count = Number(l?.items_count ?? 0);
            const owner = l?.owner || l?.owner_username || l?.username || "unknown";
            const title = l?.title || l?.name || "Untitled list";

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

                    {l?.description ? <div className="mt-2 text-sm text-zinc-500">{l.description}</div> : null}
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