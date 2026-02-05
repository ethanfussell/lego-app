// frontend_next/app/lists/public/PublicListsClient.tsx
"use client";

import React, { useEffect, useState } from "react";
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
};

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function isPublicList(x: unknown): x is PublicList {
  if (typeof x !== "object" || x === null) return false;
  const id = (x as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number";
}

function toPublicListArray(x: unknown): PublicList[] {
  return Array.isArray(x) ? x.filter(isPublicList) : [];
}

export default function PublicListsClient() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lists, setLists] = useState<PublicList[]>([]);

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

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">Public Lists</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Browse lists shared by the community.
        </p>
      </div>

      {loading ? <p className="mt-6 text-sm">Loading…</p> : null}
      {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      {!loading && !err && lists.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No public lists yet.</p>
      ) : null}

      {!loading && !err && lists.length > 0 ? (
        <ul className="mt-6 grid list-none gap-3 p-0">
          {lists.map((l) => {
            const id = l.id;
            const title = (l.title ?? l.name ?? `List ${String(id)}`).trim();
            const owner = (l.owner ?? l.owner_username ?? l.username ?? "").trim();
            const count =
              typeof l.items_count === "number" && Number.isFinite(l.items_count) ? l.items_count : null;
            const desc = (l.description ?? "").trim();

            return (
              <li key={String(id)}>
                <Link
                  href={`/lists/${encodeURIComponent(String(id))}`}
                  className="block rounded-2xl border border-black/[.06] bg-white p-4 shadow-sm hover:shadow-md dark:border-white/[.10] dark:bg-zinc-950"
                >
                  <div className="text-sm font-semibold">{title || `List ${String(id)}`}</div>

                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {(owner ? `by ${owner}` : "—") + (count != null ? ` • ${count} sets` : "")}
                  </div>

                  {desc ? (
                    <div className="mt-2 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">
                      {desc}
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
