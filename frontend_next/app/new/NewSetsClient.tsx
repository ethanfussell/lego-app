// frontend_next/app/new/NewSetsClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import type { MonthKey } from "./featuredThemes";
import type { SetLite } from "@/lib/types";

type CollectionRow = { set_num: string };
type SetCardSet = React.ComponentProps<typeof SetCard>["set"];

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function isCollectionRow(x: unknown): x is CollectionRow {
  return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
}

function toCollectionRowArray(x: unknown): CollectionRow[] {
  return Array.isArray(x) ? x.filter(isCollectionRow) : [];
}

async function fetchCollectionSetNums(token: string, path: "/collections/me/owned" | "/collections/me/wishlist") {
  const raw = await apiFetch<unknown>(path, { token, cache: "no-store" });
  const rows = toCollectionRowArray(raw);
  return new Set(rows.map((r) => String(r.set_num || "").trim()).filter(Boolean));
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "owned" | "wish" }) {
  const cls =
    tone === "owned"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200";

  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

function isSafeNextImageSrc(src: unknown): src is string {
  if (typeof src !== "string") return false;
  const s = src.trim();
  if (!s) return false;
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/");
}

function toSetCardSet(s: SetLite): SetCardSet {
  const safeImage = isSafeNextImageSrc(s.image_url) ? s.image_url!.trim() : null;
  return {
    ...(s as unknown as SetCardSet),
    image_url: safeImage,
  };
}

function QuickStatsBar({ sets }: { sets: SetLite[] }) {
  const total = sets.length;

  const themeCount = useMemo(() => {
    const uniq = new Set(sets.map((s) => (typeof s.theme === "string" ? s.theme.trim() : "")).filter(Boolean));
    return uniq.size;
  }, [sets]);

  const biggest = useMemo(() => {
    let best: SetLite | null = null;
    for (const s of sets) {
      const p = typeof s.pieces === "number" ? s.pieces : null;
      if (p == null) continue;
      if (!best) best = s;
      else if ((best.pieces ?? 0) < p) best = s;
    }
    return best;
  }, [sets]);

  return (
    <div className="mt-5 rounded-2xl border border-black/[.08] bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm dark:border-white/[.14] dark:bg-zinc-950 dark:text-zinc-300">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">Total releases:</span> {total}
        </div>
        <div className="text-zinc-400 dark:text-zinc-600">•</div>
        <div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">Themes:</span> {themeCount}
        </div>

        {biggest ? (
          <>
            <div className="text-zinc-400 dark:text-zinc-600">•</div>
            <div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Biggest set:</span> {biggest.set_num}
              {typeof biggest.pieces === "number" ? ` (${biggest.pieces.toLocaleString()} pcs)` : ""}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ComingSoon() {
  return (
    <section className="mt-14 rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
      <h2 className="m-0 text-base font-semibold text-zinc-900 dark:text-zinc-50">Coming soon</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        We’re upgrading this page to show official monthly release drops (not just “newly added to our database”).
      </p>

      <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
        <li>• Official monthly release calendar (global + regional where available)</li>
        <li>• “Available now” vs “preorder” labels</li>
        <li>• Theme highlights you can pick each month</li>
        <li>• Better sorting (price, popularity, rating)</li>
      </ul>
    </section>
  );
}

function CarouselRow({
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
            const sn = String(s.set_num || "").trim();
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
                <SetCard set={toSetCardSet(s)} footer={footer} />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function FeaturedThemes({
  sets,
  owned,
  wish,
  token,
  featuredThemes,
}: {
  sets: SetLite[];
  owned: Set<string>;
  wish: Set<string>;
  token: string | null;
  featuredThemes: string[];
}) {
  const themes = (featuredThemes || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!themes.length) return null;

  const byTheme = useMemo(() => {
    const map = new Map<string, SetLite[]>();
    for (const theme of themes) map.set(theme, []);

    for (const s of sets) {
      const t = typeof s.theme === "string" ? s.theme.trim() : "";
      if (!t) continue;
      if (!map.has(t)) continue;
      map.get(t)!.push(s);
    }

    for (const [k, arr] of map.entries()) {
      map.set(k, arr.slice(0, 14));
    }

    return map;
  }, [sets, themes.join("|")]);

  const any = themes.some((t) => (byTheme.get(t)?.length ?? 0) > 0);
  if (!any) return null;

  return (
    <section className="mt-10">
      <h2 className="m-0 text-base font-semibold text-zinc-900 dark:text-zinc-50">Featured themes</h2>
      <p className="mt-2 text-sm text-zinc-500">A quick look at new drops in a few highlighted themes.</p>

      {themes.map((theme) => {
        const themeSets = byTheme.get(theme) ?? [];
        return (
          <CarouselRow
            key={theme}
            title={theme}
            subtitle={themeSets.length ? `${themeSets.length} new set${themeSets.length === 1 ? "" : "s"} in this feed` : undefined}
            sets={themeSets}
            owned={owned}
            wish={wish}
            token={token}
          />
        );
      })}
    </section>
  );
}

export default function NewSetsClient({
  initialSets,
  initialError,
  monthKey,
  featuredThemes,
}: {
  initialSets: SetLite[];
  initialError: string | null;
  monthKey: MonthKey;
  featuredThemes: string[];
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
      } catch (e: unknown) {
        if (cancelled) return;
        setOwnedSetNums(new Set());
        setWishlistSetNums(new Set());
        setListsError(errorMessage(e));
      } finally {
        if (!cancelled) setListsLoading(false);
      }
    }

    loadLists();
    return () => {
      cancelled = true;
    };
  }, [token, hydrated]);

  const sets = useMemo(() => (Array.isArray(initialSets) ? initialSets : []), [initialSets]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold">New LEGO set releases this month</h1>
            <p className="mt-2 max-w-[640px] text-sm text-zinc-500">A rolling view of the newest sets we’ve seen this month.</p>
          </div>

          <div className="text-xs font-semibold text-zinc-500">{monthKey}</div>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Note: “New” is currently based on when sets were added to our database (not an official LEGO release calendar).
        </div>

        {initialError ? <p className="mt-4 text-sm text-red-600">Error loading sets: {initialError}</p> : null}

        <QuickStatsBar sets={sets} />

        {hydrated && token ? (
          <div className="mt-4 text-sm text-zinc-500">
            {listsLoading ? "Loading your lists…" : null}
            {listsError ? <span className="text-red-600"> Error loading your lists: {listsError}</span> : null}
          </div>
        ) : null}
      </section>

      {!initialError && sets.length === 0 ? <p className="mt-6 text-sm text-zinc-500">No sets found.</p> : null}

      <FeaturedThemes
        sets={sets}
        owned={ownedSetNums}
        wish={wishlistSetNums}
        token={token ?? null}
        featuredThemes={featuredThemes}
      />

      <ComingSoon />

      <section className="mt-14">
        <h2 className="m-0 text-base font-semibold text-zinc-900 dark:text-zinc-50">Full monthly drop</h2>
        <p className="mt-2 text-sm text-zinc-500">Everything in the current “new releases” feed.</p>

        <div className="mt-5 grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
          {sets.map((s) => {
            const sn = String(s.set_num || "").trim();
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
                <SetCard set={toSetCardSet(s)} footer={footer} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}