// frontend_next/app/account/AccountClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import RatingHistogram from "@/app/components/RatingHistogram";
import { readSavedListIds, savedListsEventName } from "@/lib/savedLists";

type OwnedSet = {
  set_num?: string;
  name?: string;
  theme?: string | null;
  pieces?: number | null;
};

type WishlistSet = OwnedSet;

type ListLite = {
  id?: string | number;
  title?: string;
  name?: string;
  items_count?: number;
  is_public?: boolean;
};

type ReviewStats = {
  total_reviews?: number;
  rated_reviews?: number;
  avg_rating?: number;
  rating_histogram?: any;
  recent?: any[];
};

function formatRating(rating: any) {
  if (rating === null || rating === undefined) return "—";
  const n = Number(rating);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  href,
  children,
  className,
}: {
  label: string;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const base = (
    <div
      className={[
        "rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md dark:border-white/[.14] dark:bg-zinc-950",
        className || "",
      ].join(" ")}
    >
      <div className="text-xs font-extrabold uppercase tracking-wide text-zinc-500">{label}</div>

      {children ? (
        <div className="mt-2">{children}</div>
      ) : (
        <div className="mt-2 text-3xl font-extrabold leading-none text-zinc-900 dark:text-zinc-50">
          {value}
        </div>
      )}

      {sub ? <div className="mt-1 text-sm text-zinc-500">{sub}</div> : null}
    </div>
  );

  if (!href) return base;

  return (
    <Link href={href} className="block no-underline">
      {base}
    </Link>
  );
}

function ActionTile({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md dark:border-white/[.14] dark:bg-zinc-950"
    >
      <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</div>
      <div className="mt-1 text-sm text-zinc-500">{desc}</div>
    </Link>
  );
}

function ThemeRow({ theme, count, href }: { theme: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-black/[.08] bg-white px-4 py-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md dark:border-white/[.14] dark:bg-zinc-950"
    >
      <div className="font-semibold text-zinc-900 dark:text-zinc-50">{theme}</div>
      <div className="font-semibold text-zinc-500">{count}</div>
    </Link>
  );
}

function RecentMiniReviewCard({ r }: { r: any }) {
  const setNum = String(r?.set_num || "");
  const setName = r?.set_name || setNum;
  const rating = formatRating(r?.rating);
  const text = String(r?.text || "").trim();

  const imageUrl =
    r?.image_url ||
    r?.imageUrl ||
    r?.set_image_url ||
    r?.setImageUrl ||
    r?.set_image ||
    r?.setImage ||
    null;

  return (
    <Link
      href={`/sets/${encodeURIComponent(setNum)}`}
      className="block rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md dark:border-white/[.14] dark:bg-zinc-950"
    >
      <div className="grid grid-cols-[80px_1fr] gap-3">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-xl border border-black/[.08] bg-white dark:border-white/[.14] dark:bg-zinc-950">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <div className="text-xs font-bold text-zinc-400">—</div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="line-clamp-2 font-extrabold leading-tight text-zinc-900 dark:text-zinc-50">
                {setName}
              </div>
              <div className="mt-1 text-sm text-zinc-500">{setNum}</div>
            </div>

            <div className="shrink-0 whitespace-nowrap font-extrabold text-zinc-900 dark:text-zinc-50">
              {rating} <span className="text-sm">★</span>
            </div>
          </div>

          {text ? (
            <div className="mt-2 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">{text}</div>
          ) : (
            <div className="mt-2 text-sm text-zinc-400">No review text</div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function AccountClient() {
  const router = useRouter();
  const { token, me, logout, hydrated } = useAuth();
  const isLoggedIn = hydrated && !!token;

  const username = useMemo(() => me?.username || "Account", [me?.username]);

  const [owned, setOwned] = useState<OwnedSet[]>([]);
  const [wishlist, setWishlist] = useState<WishlistSet[]>([]);
  const [customLists, setCustomLists] = useState<ListLite[]>([]);
  const [publicLists, setPublicLists] = useState<ListLite[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [reviewStatsLoading, setReviewStatsLoading] = useState(false);
  const [reviewStatsErr, setReviewStatsErr] = useState("");

  const [recentEnriched, setRecentEnriched] = useState<any[]>([]);

  // ---- Saved lists count (storage + same-tab custom event) ----
  const [savedCount, setSavedCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return readSavedListIds().length;
  });

  useEffect(() => {
    function refresh() {
      setSavedCount(readSavedListIds().length);
    }
    refresh();

    const evt = savedListsEventName();
    window.addEventListener("storage", refresh);
    window.addEventListener(evt, refresh as any);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(evt, refresh as any);
    };
  }, []);

  // ---- Derived stats ----
  const totalReviews = reviewStats?.total_reviews ?? null;
  const ratedReviews = reviewStats?.rated_reviews ?? null;
  const avgRating = reviewStats?.avg_rating ?? null;

  // IMPORTANT: memoize to keep a stable reference for effect deps
  const recentReviewsRaw = useMemo(() => {
    const arr = Array.isArray(reviewStats?.recent) ? (reviewStats!.recent as any[]) : [];
    return arr.slice(0, 6);
  }, [reviewStats?.recent]);

  const ownedCount = owned.length;
  const wishlistCount = wishlist.length;

  const piecesOwned = useMemo(() => {
    let total = 0;
    for (const s of owned) total += Number(s?.pieces || 0);
    return total;
  }, [owned]);

  const avgPieces = ownedCount > 0 ? Math.round(piecesOwned / ownedCount) : 0;

  const topThemes = useMemo(() => {
    const freq = new Map<string, number>();
    for (const s of owned) {
      const t = String(s?.theme || "").trim();
      if (!t) continue;
      freq.set(t, (freq.get(t) || 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .slice(0, 3);
  }, [owned]);

  // ---- Load account data ----
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      if (!hydrated) return;

      if (!isLoggedIn) {
        setOwned([]);
        setWishlist([]);
        setCustomLists([]);
        setPublicLists([]);
        setReviewStats(null);
        setReviewStatsErr("");
        setErr("");
        setRecentEnriched([]);
        return;
      }

      setLoading(true);
      setErr("");
      setReviewStatsLoading(true);
      setReviewStatsErr("");

      try {
        const [ownedData, wishlistData, custom, pub, stats] = await Promise.all([
          apiFetch<any>("/collections/me/owned", { token, cache: "no-store" }),
          apiFetch<any>("/collections/me/wishlist", { token, cache: "no-store" }),
          apiFetch<any>("/lists/me?include_system=false", { token, cache: "no-store" }),
          apiFetch<any>(`/lists/public?owner=${encodeURIComponent(username)}`, { cache: "no-store" }),
          apiFetch<any>("/reviews/me/stats", { token, cache: "no-store" }),
        ]);

        if (cancelled) return;

        setOwned(Array.isArray(ownedData) ? ownedData : []);
        setWishlist(Array.isArray(wishlistData) ? wishlistData : []);
        setCustomLists(Array.isArray(custom) ? custom : []);
        setPublicLists(Array.isArray(pub) ? pub : []);
        setReviewStats(stats || null);
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message || String(e);
        setErr(msg);
        setReviewStats(null);
        setReviewStatsErr(msg);
      } finally {
        if (cancelled) return;
        setLoading(false);
        setReviewStatsLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isLoggedIn, token, username]);

  // ---- Enrich recent review cards with images if needed ----
  useEffect(() => {
    let cancelled = false;

    async function enrichRecent() {
      if (!token) {
        setRecentEnriched([]);
        return;
      }

      if (!recentReviewsRaw.length) {
        setRecentEnriched([]);
        return;
      }

      const need = recentReviewsRaw
        .filter((r) => !(r?.image_url || r?.imageUrl || r?.set_image_url || r?.setImageUrl))
        .map((r) => r?.set_num)
        .filter(Boolean);

      if (!need.length) {
        setRecentEnriched(recentReviewsRaw);
        return;
      }

      try {
        const qs = encodeURIComponent([...new Set(need)].join(","));
        const sets = await apiFetch<any>(`/sets/bulk?set_nums=${qs}`, { token, cache: "no-store" });

        if (cancelled) return;

        const byNum = new Map((Array.isArray(sets) ? sets : []).map((s) => [s?.set_num, s]));

        const merged = recentReviewsRaw.map((r) => {
          const s = byNum.get(r?.set_num);
          return {
            ...r,
            image_url:
              r?.image_url ||
              r?.imageUrl ||
              r?.set_image_url ||
              r?.setImageUrl ||
              s?.image_url ||
              s?.imageUrl ||
              s?.set_image_url ||
              s?.setImageUrl ||
              null,
          };
        });

        setRecentEnriched(merged);
      } catch {
        if (!cancelled) setRecentEnriched(recentReviewsRaw);
      }
    }

    enrichRecent();
    return () => {
      cancelled = true;
    };
  }, [token, recentReviewsRaw]);

  const recentToShow = recentEnriched.length ? recentEnriched : recentReviewsRaw;

  // Make review-stat tiles match the top stat tiles, without changing the top tiles.
  // Adjust once if needed (try 96 / 104 / 112).
  const REVIEW_TILE_H = "h-[96px]";

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16">
      <div className="mt-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold">Account</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {isLoggedIn ? (
              <>
                Signed in as{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{username}</span>
              </>
            ) : (
              "Log in to see your stats."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/collection")}
            className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            My Collection
          </button>

          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/20"
            >
              Logout
            </button>
          ) : null}
        </div>
      </div>

      {!isLoggedIn ? (
        <div className="mt-6">
          <CardShell>
            <p className="m-0 text-sm text-zinc-600 dark:text-zinc-400">
              You’re not logged in. Go to{" "}
              <Link href="/login" className="font-semibold hover:underline">
                /login
              </Link>{" "}
              to sign in.
            </p>
          </CardShell>
        </div>
      ) : (
        <>
          <div className="mt-6">
            {loading ? <p className="m-0 text-sm">Loading your stats…</p> : null}
            {err ? <p className="m-0 text-sm text-red-600">Error: {err}</p> : null}
          </div>

          {/* SUMMARY STATS */}
          <section className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            <StatCard label="Owned sets" value={ownedCount} href="/collection/owned" />
            <StatCard label="Wishlist" value={wishlistCount} href="/collection/wishlist" />
            <StatCard label="Pieces owned" value={piecesOwned.toLocaleString()} />
            <StatCard label="Custom lists" value={customLists.length} href="/account/lists" />
            <StatCard label="Saved lists" value={savedCount} href="/account/saved-lists" />
            <StatCard label="Reviews" value={totalReviews == null ? "—" : totalReviews} href="/account/reviews" />
            <StatCard label="Followers" value="0" sub="Coming soon" />
            <StatCard label="Following" value="0" sub="Coming soon" />
          </section>

          {/* REVIEW STATS */}
          <section className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="font-semibold">Review stats</div>
                <div className="mt-1 text-sm text-zinc-500">Your ratings breakdown and recent reviews.</div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/account/reviews")}
                className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
              >
                View all reviews
              </button>
            </div>

            {reviewStatsLoading ? <p className="mt-3 text-sm">Loading review stats…</p> : null}
            {reviewStatsErr ? <p className="mt-3 text-sm text-red-600">Error: {reviewStatsErr}</p> : null}

            {!reviewStatsLoading && !reviewStatsErr && reviewStats ? (
              <div className="mt-4 grid gap-3">
                {/* IMPORTANT:
                    - no auto-rows-fr
                    - no tall histogram height that forces the row taller
                    - fixed height only for these review tiles */}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 items-start">
                  <StatCard
                    label="Total reviews"
                    value={totalReviews == null ? "—" : totalReviews}
                    href="/account/reviews"
                    className={REVIEW_TILE_H}
                  />

                  <StatCard
                    label="Rated reviews"
                    value={ratedReviews == null ? "—" : ratedReviews}
                    href="/account/reviews?filter=rated"
                    className={REVIEW_TILE_H}
                  />

                  <div
                    className={[
                      REVIEW_TILE_H,
                      "rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950",
                      "flex flex-col",
                    ].join(" ")}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-zinc-500">
                        Ratings breakdown
                      </div>
                      <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
                        Avg {avgRating == null ? "—" : Number(avgRating).toFixed(2)}
                      </div>
                    </div>

                    {/* Fill remaining space inside the fixed-height tile (won't grow the row) */}
                    <div className="mt-2 flex flex-1 items-end justify-center overflow-hidden">
                      <RatingHistogram
                        histogram={reviewStats.rating_histogram}
                        height={40} // keep within the fixed tile height
                        barWidth={16}
                        gap={10}
                        showLabels={false}
                        maxWidth={420}
                        paddingY={0}
                        paddingX={0}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold">Recent reviews</div>
                  {recentToShow.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">No recent reviews.</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-3">
                      {recentToShow.map((r) => (
                        <RecentMiniReviewCard
                          key={`${r?.set_num || "x"}-${r?.created_at || r?.createdAt || Math.random()}`}
                          r={r}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          {/* TOP THEMES */}
          <section className="mt-10">
            <div className="font-semibold">Top themes (owned)</div>

            {topThemes.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No owned sets yet.</p>
            ) : (
              <div className="mt-3 grid max-w-xl gap-2">
                {topThemes.map(([theme, count]) => (
                  <ThemeRow key={theme} theme={theme} count={count} href={`/collection/owned?theme=${encodeURIComponent(theme)}`} />
                ))}
              </div>
            )}
          </section>

          {/* QUICK ACTIONS */}
          <section className="mt-10">
            <div className="font-semibold">Quick actions</div>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
              <ActionTile title="Manage my lists" desc="Create + edit your lists." href="/account/lists" />
              <ActionTile
                title="Browse community lists"
                desc="See what other users are building and tracking."
                href="/discover/lists"
              />
              <ActionTile title="Find sets" desc="Search and explore new sets to add." href="/search" />
              <ActionTile title="My reviews" desc="See every set you reviewed (rating + text)." href="/account/reviews" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}