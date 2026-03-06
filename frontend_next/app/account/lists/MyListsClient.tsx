// frontend_next/app/account/lists/MyListsClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/app/components/EmptyState";
import ErrorState from "@/app/components/ErrorState";

type ListRow = {
  id?: string | number;
  title?: string;
  name?: string;
  items_count?: number;
  items?: unknown[];
  is_public?: boolean;
  is_system?: boolean;
  system_key?: string | null;
};

function errorMessage(e: unknown, fallback = "Failed to load lists"): string {
  return e instanceof Error ? e.message : String((e as { message?: unknown } | null)?.message ?? fallback);
}

export default function MyListsClient() {
  const { token, hydrated } = useAuth();
  const isLoggedIn = hydrated && !!token;

  const [lists, setLists] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hydrated) return;

      if (!isLoggedIn || !token) {
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
        setLists(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        if (!cancelled) setErr(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
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
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="m-0 text-sm text-zinc-500">
            You’re not logged in. Go to{" "}
            <Link href="/login" className="font-semibold hover:underline">
              /login
            </Link>{" "}
            to sign in.
          </p>
        </div>
      ) : (
        <>
          {loading ? <div className="mt-6 animate-pulse space-y-3"><div className="h-4 w-32 rounded bg-zinc-200" /><div className="h-3 w-24 rounded bg-zinc-100" /></div> : null}
          {err ? <div className="mt-6"><ErrorState message={err} onRetry={() => window.location.reload()} /></div> : null}

          {!loading && !err && lists.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No lists yet"
                description="Create custom lists to organize your favorite sets"
                action={{ href: "/account/lists", label: "Create a list" }}
              />
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            {lists.map((l) => {
              const id = l.id;
              if (id === null || id === undefined) return null;

              const title = l.title || l.name || "Untitled list";
              const count =
                typeof l.items_count === "number"
                  ? l.items_count
                  : Array.isArray(l.items)
                    ? l.items.length
                    : 0;

              const vis = l.is_public ? "Public" : "Private";

              return (
                <Link
                  key={String(id)}
                  href={`/lists/${encodeURIComponent(String(id))}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="font-extrabold text-zinc-900">{title}</div>
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