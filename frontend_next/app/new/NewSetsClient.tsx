// frontend_next/app/new/NewClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SetCard from "@/app/components/SetCard";
import AddToListMenu from "@/app/components/AddToListMenu";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string;
  image_url?: string | null;
  average_rating?: number | null;
  rating_avg?: number | null;
  rating_count?: number;
};

function extractSetNums(payload: any): string[] {
  // supports:
  // - ["1234-1", ...]
  // - [{ set_num: "1234-1" }, ...]
  // - { results: [...] }
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
    ? payload.results
    : [];

  return arr
    .map((x: any) => (typeof x === "string" ? x : x?.set_num))
    .filter((x: any) => typeof x === "string" && x.trim() !== "")
    .map((s: string) => s.trim());
}

/**
 * Try a few common endpoints (so this works even if your backend paths differ).
 * When you confirm the correct ones, delete the extras and keep 1 per list.
 */
async function fetchFirstWorkingList(opts: { token: string; paths: string[] }): Promise<string[]> {
  for (const p of opts.paths) {
    try {
      const data = await apiFetch<any>(p, { token: opts.token, cache: "no-store" });
      return extractSetNums(data);
    } catch {
      // try next
    }
  }
  return [];
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "owned" | "wish" }) {
  const cls =
    tone === "owned"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function SetRow({
  title,
  subtitle,
  sets,
  owned,
  wish,
  token,
}: {
  title: string;
  subtitle?: string;
  sets: SetLite[];
  owned: Set<string>;
  wish: Set<string>;
  token: string | null;
}) {
  if (!sets.length) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-semibold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2">
        <ul className="m-0 flex list-none gap-3 p-0">
          {sets.map((set) => {
            const isOwned = owned.has(set.set_num);
            const isWish = wish.has(set.set_num);

            return (
              <li key={set.set_num} className="w-[220px] shrink-0">
                <div className="rounded-2xl">
                  <SetCard set={set as any} />

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isOwned ? <Badge tone="owned">Owned</Badge> : null}
                    {isWish ? <Badge tone="wish">Wishlist</Badge> : null}
                  </div>

                  {token ? (
                    <div className="mt-2">
                      <AddToListMenu token={token} setNum={set.set_num} />
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-zinc-500">
                      <Link href="/login" className="font-semibold hover:underline">
                        Log in
                      </Link>{" "}
                      to add to lists
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default function NewClient({
  initialSets,
  initialError,
}: {
  initialSets: SetLite[];
  initialError: string | null;
}) {
  const { token, hydrated } = useAuth();

  const [ownedSetNums, setOwnedSetNums] = useState<Set<string>>(new Set());
  const [wishlistSetNums, setWishlistSetNums] = useState<Set<string>>(new Set());
  const [listsError, setListsError] = useState<string | null>(null);
  const [listsLoading, setListsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLists() {
      setListsError(null);

      if (!hydrated) return;
      if (!token) {
        setOwnedSetNums(new Set());
        setWishlistSetNums(new Set());
        return;
      }

      setListsLoading(true);
      try {
        // ✅ Replace these with your known-good endpoints once you confirm them.
        // I included multiple candidates so this “just works” while migrating.
        const [owned, wish] = await Promise.all([
          fetchFirstWorkingList({
            token,
            paths: [
              "/collection/owned",
              "/users/me/owned",
              "/lists/owned/items",
              "/lists/me/owned",
            ],
          }),
          fetchFirstWorkingList({
            token,
            paths: [
              "/collection/wishlist",
              "/users/me/wishlist",
              "/lists/wishlist/items",
              "/lists/me/wishlist",
            ],
          }),
        ]);

        if (cancelled) return;
        setOwnedSetNums(new Set(owned));
        setWishlistSetNums(new Set(wish));
      } catch (e: any) {
        if (cancelled) return;
        setListsError(e?.message || String(e));
      } finally {
        if (!cancelled) setListsLoading(false);
      }
    }

    loadLists();
    return () => {
      cancelled = true;
    };
  }, [token, hydrated]);

  const newSets = Array.isArray(initialSets) ? initialSets : [];

  const justReleased = useMemo(() => newSets.slice(0, 12), [newSets]);
  const moreNewRow = useMemo(() => newSets.slice(12, 24), [newSets]);
  const moreNewGrid = useMemo(() => newSets.slice(24), [newSets]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* Hero */}
      <section className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">New LEGO sets</h1>
        <p className="mt-2 max-w-[560px] text-sm text-zinc-500">
          See the latest LEGO releases first. Scroll through the newest sets, spotlighted picks,
          and upcoming releases all in one place.
        </p>
        <p className="mt-2 text-xs text-zinc-400">Placeholder feed · later this will sync with real release data.</p>

        {initialError ? <p className="mt-4 text-sm text-red-600">Error loading new sets: {initialError}</p> : null}

        {/* Lists status */}
        {hydrated && token ? (
          <div className="mt-4 text-sm text-zinc-500">
            {listsLoading ? "Loading your lists…" : null}
            {listsError ? <span className="text-red-600">Error loading your lists: {listsError}</span> : null}
          </div>
        ) : null}
      </section>

      {!initialError && newSets.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No new sets found yet.</p>
      ) : null}

      {/* Row 1 */}
      <SetRow
        title="Just released"
        subtitle="The absolute newest sets, sorted by release year."
        sets={justReleased}
        owned={ownedSetNums}
        wish={wishlistSetNums}
        token={token ?? null}
      />

      {/* Row 2 */}
      <SetRow
        title="More new sets"
        subtitle="Keep scrolling for even more fresh releases."
        sets={moreNewRow}
        owned={ownedSetNums}
        wish={wishlistSetNums}
        token={token ?? null}
      />

      {/* Grid */}
      {moreNewGrid.length > 0 ? (
        <section className="mt-12">
          <h2 className="m-0 text-lg font-semibold">All recent releases</h2>
          <p className="mt-1 text-sm text-zinc-500">Explore even more of the latest sets.</p>

          <ul className="mt-5 grid list-none gap-4 p-0 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {moreNewGrid.map((set) => {
              const isOwned = ownedSetNums.has(set.set_num);
              const isWish = wishlistSetNums.has(set.set_num);

              return (
                <li key={set.set_num}>
                  <SetCard set={set as any} />

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isOwned ? <Badge tone="owned">Owned</Badge> : null}
                    {isWish ? <Badge tone="wish">Wishlist</Badge> : null}
                  </div>

                  {token ? (
                    <div className="mt-2">
                      <AddToListMenu token={token} setNum={set.set_num} />
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-zinc-500">
                      <Link href="/login" className="font-semibold hover:underline">
                        Log in
                      </Link>{" "}
                      to add to lists
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}