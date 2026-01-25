"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";

type ListSummary = {
  id: string | number;
  title?: string | null;
  is_public?: boolean | null;
  items_count?: number | null;
  system_key?: string | null;
};

function isSystemList(l: ListSummary) {
  return !!String(l?.system_key || "").trim();
}

export default function ListsClient() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [lists, setLists] = useState<ListSummary[]>([]);

  // create form
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  const customLists = useMemo(() => lists.filter((l) => !isSystemList(l)), [lists]);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const mine = await apiFetch<ListSummary[]>("/lists/me", { token, cache: "no-store" });
      setLists(Array.isArray(mine) ? mine : []);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setLists([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createList() {
    const t = title.trim();
    if (!t || !token || creating) return;

    setCreating(true);
    setErr(null);
    try {
      // Most common shape: POST /lists { title, is_public }
      await apiFetch("/lists", {
        token,
        method: "POST",
        body: { title: t, is_public: isPublic },
      });
      setTitle("");
      setIsPublic(false);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  async function togglePublic(l: ListSummary) {
    if (!token) return;
    const id = String(l.id);
    const next = !l.is_public;

    // optimistic
    setLists((prev) => prev.map((x) => (String(x.id) === id ? { ...x, is_public: next } : x)));

    try {
      // Most common shape: PATCH /lists/{id} { is_public }
      await apiFetch(`/lists/${encodeURIComponent(id)}`, {
        token,
        method: "PATCH",
        body: { is_public: next },
      });
    } catch (e: any) {
      // rollback
      setLists((prev) => prev.map((x) => (String(x.id) === id ? { ...x, is_public: l.is_public } : x)));
      setErr(e?.message || String(e));
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">My Lists</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Create custom lists, toggle public/private, and open a list to add sets.
        </p>

        <div className="mt-6 rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.14] dark:bg-zinc-950">
          <div className="font-semibold">Create a list</div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. ‘Space sets I want’, ‘City MOCs’, …"
              className="w-full flex-1 rounded-xl border border-black/[.10] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[.14] dark:bg-zinc-950 dark:focus:ring-white/10"
            />

            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Public
            </label>

            <button
              type="button"
              onClick={createList}
              disabled={!title.trim() || creating}
              className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>

        {loading ? <p className="mt-6 text-sm">Loading…</p> : null}
        {err ? <p className="mt-4 text-sm text-red-600">Error: {err}</p> : null}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Your custom lists</h2>
          <div className="text-sm text-zinc-500">{customLists.length} lists</div>
        </div>

        {customLists.length === 0 ? (
          <div className="rounded-2xl border border-black/[.08] bg-white p-6 text-sm text-zinc-600 dark:border-white/[.14] dark:bg-zinc-950 dark:text-zinc-400">
            No custom lists yet. Create one above.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {customLists.map((l) => {
              const id = String(l.id);
              return (
                <div
                  key={id}
                  className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.14] dark:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{l.title || `List ${id}`}</div>
                      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {l.items_count ?? 0} sets • {l.is_public ? "Public" : "Private"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePublic(l)}
                      className="rounded-full border border-black/[.10] px-3 py-1 text-xs font-semibold hover:bg-black/[.04] dark:border-white/[.14] dark:hover:bg-white/[.06]"
                      title="Toggle public/private"
                    >
                      {l.is_public ? "Make private" : "Make public"}
                    </button>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/lists/${encodeURIComponent(id)}`}
                      className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-white dark:text-black"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={refresh}
                      className="rounded-xl border border-black/[.10] px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.14] dark:hover:bg-white/[.06]"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}