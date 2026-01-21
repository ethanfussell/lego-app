// frontend_next/app/account/saved-lists/SavedListsClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";

function readSavedIds() {
  try {
    const raw = localStorage.getItem("saved_list_ids");
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function SavedListsClient() {
  const { token } = useAuth();

  const [savedIds, setSavedIds] = useState<string[]>(() => (typeof window === "undefined" ? [] : readSavedIds()));
  const [lists, setLists] = useState<any[]>([]);
  const [missingCount, setMissingCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    function refresh() {
      setSavedIds(readSavedIds());
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("saved_lists_updated", refresh as any);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("saved_lists_updated", refresh as any);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr("");
        setMissingCount(0);

        if (savedIds.length === 0) {
          setLists([]);
          return;
        }

        const results = await Promise.allSettled(
          savedIds.map((id) => apiFetch<any>(`/lists/${encodeURIComponent(id)}`, { token, cache: "no-store" }))
        );

        if (cancelled) return;

        const ok: any[] = [];
        let missing = 0;

        for (const r of results) {
          if (r.status === "fulfilled" && r.value) ok.push(r.value);
          else missing += 1;
        }

        setLists(ok);
        setMissingCount(missing);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load saved lists");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, savedIds]);

  return (
    <div className="mx-auto max-w-4xl px-6 pb-16">
      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold">Saved Lists</h1>
          <p className="mt-2 text-sm text-zinc-500">Lists you bookmarked.</p>
        </div>

        <Link
          href="/discover/lists"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
        >
          Browse community lists
        </Link>
      </div>

      {loading ? <p className="mt-6 text-sm">Loading…</p> : null}
      {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      {!loading && !err && savedIds.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">You haven’t saved any lists yet.</p>
      ) : null}

      {!loading && !err && savedIds.length > 0 && lists.length === 0 ? (
        <div className="mt-6 text-sm text-zinc-500">
          <p className="m-0">None of your saved lists could be loaded.</p>
          <p className="mt-2 text-xs text-zinc-400">They may have been deleted or set to private.</p>
        </div>
      ) : null}

      {!loading && !err && missingCount > 0 && lists.length > 0 ? (
        <p className="mt-4 text-xs text-zinc-500">
          {missingCount} saved list{missingCount === 1 ? "" : "s"} couldn’t be loaded (deleted/private).
        </p>
      ) : null}

      <div className="mt-6 grid gap-3">
        {lists.map((l) => {
          const id = l?.id;
          if (!id) return null;

          const title = l?.title || l?.name || "Untitled list";
          const itemsCount = Array.isArray(l?.items) ? l.items.length : l?.items_count ?? 0;
          const owner = l?.owner || l?.owner_username || l?.username || "—";
          const isPublic = !!l?.is_public;

          return (
            <Link
              key={String(id)}
              href={`/lists/${encodeURIComponent(String(id))}`}
              className="block rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm hover:shadow-md dark:border-white/[.14] dark:bg-zinc-950"
            >
              <div className="font-extrabold text-zinc-900 dark:text-zinc-50">{title}</div>
              <div className="mt-1 text-sm text-zinc-500">
                {itemsCount} sets · {isPublic ? "Public" : "Private"} · by {owner}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}