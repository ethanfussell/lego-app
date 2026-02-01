// frontend_next/app/new/NewSetsClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
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

type CollectionRow = {
  set_num: string;
};

function Badge({ children, tone }: { children: React.ReactNode; tone: "owned" | "wish" }) {
  const cls =
    tone === "owned"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200";

  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

async function fetchCollectionSetNums(token: string, path: "/collections/me/owned" | "/collections/me/wishlist") {
  const rows = await apiFetch<CollectionRow[]>(path, { token, cache: "no-store" });
  const arr = Array.isArray(rows) ? rows : [];
  return new Set(arr.map((r) => String(r?.set_num || "").trim()).filter(Boolean));
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
          {sets.map((s) => {
            const sn = String(s?.set_num || "").trim();
            if (!sn) return null;

            const isOwned = owned.has(sn);
            const isWish = wish.has(sn);

            const footer = (
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {isOwned ? <Badge tone="owned">Owned</Badge> : null}
                  {isWish ? <Badge tone="wish">Wishlist</Badge> : null}
                </div>

                {token ? <SetCardActions token={token} setNum={sn} /> : null}
              </div>
            );

            return (
              <li key={sn} className="w-[220px] shrink-0">
                <SetCard set={s as any} footer={footer} />
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
        const [owned, wish] = await Promise.all([
          fetchCollectionSetNums(token, "/collections/me/owned"),
          fetchCollectionSetNums(token, "/collections/me/wishlist"),
        ]);

        if (cancelled) return;
        setOwnedSetNums(owned);
        setWishlistSetNums(wish);
      } catch (e: any) {
        if (cancelled) return;
        setOwnedSetNums(new Set());
        setWishlistSetNums(new Set());
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
          See the latest LEGO releases first. Scroll through the newest sets and spotlighted picks.
        </p>

        {initialError ? <p className="mt-4 text-sm text-red-600">Error loading new sets: {initialError}</p> : null}

        {/* Lists status */}
        {hydrated && token ? (
          <div className="mt-4 text-sm text-zinc-500">
            {listsLoading ? "Loading your lists…" : null}
            {listsError ? <span className="text-red-600"> Error loading your lists: {listsError}</span> : null}
          </div>
        ) : null}
      </section>

      {!initialError && newSets.length === 0 ? <p className="mt-6 text-sm text-zinc-500">No new sets found yet.</p> : null}

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

          <div className="mt-5 grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
            {moreNewGrid.map((s) => {
              const sn = String(s?.set_num || "").trim();
              if (!sn) return null;

              const isOwned = ownedSetNums.has(sn);
              const isWish = wishlistSetNums.has(sn);

              const footer = (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {isOwned ? <Badge tone="owned">Owned</Badge> : null}
                    {isWish ? <Badge tone="wish">Wishlist</Badge> : null}
                  </div>

                  {token ? <SetCardActions token={token} setNum={sn} /> : null}
                </div>
              );

              return (
                <div key={sn} className="w-[220px]">
                  <SetCard set={s as any} footer={footer} />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}