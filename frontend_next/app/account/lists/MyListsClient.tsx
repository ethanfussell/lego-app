// frontend_next/app/account/lists/MyListsClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";

export default function MyListsClient() {
  const { token, hydrated } = useAuth();
  const isLoggedIn = hydrated && !!token;

  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hydrated) return;

      if (!isLoggedIn) {
        setLists([]);
        setLoading(false);
        setErr("");
        return;
      }

      try {
        setLoading(true);
        setErr("");

        const data = await apiFetch<any>("/lists/me?include_system=false", { token, cache: "no-store" });
        if (cancelled) return;

        setLists(Array.isArray(data) ? data : []);
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
  }, [hydrated, isLoggedIn, token]);

  return (
    <div className="mx-auto max-w-4xl px-6 pb-16">
      <div className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">My Lists</h1>
        <p className="mt-2 text-sm text-zinc-500">Your custom lists (excluding system lists).</p>
      </div>

      {!isLoggedIn ? (
        <div className="mt-6 rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
          <p className="m-0 text-sm text-zinc-600 dark:text-zinc-400">
            You’re not logged in. Go to{" "}
            <Link href="/login" className="font-semibold hover:underline">
              /login
            </Link>{" "}
            to sign in.
          </p>
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
              if (!id) return null;

              const title = l?.title || l?.name || "Untitled list";
              const count = l?.items_count ?? (Array.isArray(l?.items) ? l.items.length : 0);
              const vis = l?.is_public ? "Public" : "Private";

              return (
                <Link
                  key={String(id)}
                  href={`/lists/${encodeURIComponent(String(id))}`}
                  className="block rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm hover:shadow-md dark:border-white/[.14] dark:bg-zinc-950"
                >
                  <div className="font-extrabold text-zinc-900 dark:text-zinc-50">{title}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {count} sets · {vis}
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