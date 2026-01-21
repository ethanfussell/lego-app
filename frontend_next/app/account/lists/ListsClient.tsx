// frontend_next/app/account/lists/ListsClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";

type ListRow = {
  id: string | number;
  title?: string;
  name?: string;
  items_count?: number;
  items?: any[];
  is_public?: boolean;
  is_system?: boolean;
  system_key?: string | null;
};

function isSystemList(l: ListRow) {
  if (l?.is_system) return true;
  const k = String(l?.system_key || "").toLowerCase();
  return k === "owned" || k === "wishlist";
}

export default function ListsClient() {
  const { token, hydrated } = useAuth();

  const [lists, setLists] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hydrated) return;

      if (!token) {
        setLists([]);
        setLoading(false);
        setErr("");
        return;
      }

      try {
        setLoading(true);
        setErr("");

        const data = await apiFetch<ListRow[]>("/lists/me?include_system=false", {
          token,
          cache: "no-store",
        });

        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        setLists(arr.filter((l) => !isSystemList(l)));
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load lists");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, hydrated]);

  return (
    <div className="mx-auto max-w-4xl px-6 pb-16">
      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold">My Lists</h1>
          <p className="mt-2 text-sm text-zinc-500">Your custom lists (not Owned/Wishlist).</p>
        </div>

        <Link
          href="/account"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
        >
          ← Back to Account
        </Link>
      </div>

      {!token ? (
        <div className="mt-6 rounded-2xl border border-black/[.08] bg-white p-4 text-sm text-zinc-600 shadow-sm dark:border-white/[.14] dark:bg-zinc-950 dark:text-zinc-400">
          You’re not logged in. Go to{" "}
          <Link href="/login" className="font-semibold hover:underline">
            /login
          </Link>{" "}
          to view your lists.
        </div>
      ) : (
        <>
          {loading ? <p className="mt-6 text-sm">Loading…</p> : null}
          {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

          {!loading && !err && lists.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">You don’t have any lists yet.</p>
          ) : null}

          <div className="mt-6 grid gap-3">
            {lists.map((l) => {
              const id = l?.id;
              if (id === null || id === undefined) return null;

              const title = l?.title || l?.name || "Untitled list";
              const count = Array.isArray(l?.items) ? l.items.length : Number(l?.items_count ?? 0);
              const isPublic = !!l?.is_public;

              return (
                <Link
                  key={String(id)}
                  href={`/lists/${encodeURIComponent(String(id))}`}
                  className="block rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm hover:shadow-md dark:border-white/[.14] dark:bg-zinc-950"
                >
                  <div className="font-extrabold text-zinc-900 dark:text-zinc-50">{title}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {count} sets · {isPublic ? "Public" : "Private"}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}