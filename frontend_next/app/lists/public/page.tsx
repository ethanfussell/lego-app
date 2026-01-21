"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type ListSummary = {
  id: number | string;
  title?: string;
  description?: string | null;
  is_public?: boolean;
  owner?: string;
  items_count?: number;
};

export default function PublicListsPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lists, setLists] = useState<ListSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);
        const data = await apiFetch<ListSummary[]>("/lists/public", { cache: "no-store" });
        if (!cancelled) setLists(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">Public Lists</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Browse lists shared by the community.</p>
      </div>

      {loading && <p className="mt-6 text-sm">Loading…</p>}
      {err && <p className="mt-6 text-sm text-red-600">Error: {err}</p>}

      <ul className="mt-6 grid gap-3 list-none p-0">
        {lists.map((l) => (
          <li key={String(l.id)}>
            <Link
              href={`/lists/${encodeURIComponent(String(l.id))}`}
              className="block rounded-2xl border border-black/[.06] bg-white p-4 shadow-sm hover:shadow-md dark:border-white/[.10] dark:bg-zinc-950"
            >
              <div className="text-sm font-semibold">{l.title || `List ${l.id}`}</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {(l.owner ? `by ${l.owner}` : "—") + (typeof l.items_count === "number" ? ` • ${l.items_count} sets` : "")}
              </div>
              {l.description ? (
                <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">{l.description}</div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}