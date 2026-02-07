// frontend_next/app/account/AccountClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import RatingHistogram from "@/app/components/RatingHistogram";
import { readSavedListIds, savedListsEventName } from "@/lib/savedLists";

/** ✅ Use the EXACT prop type expected by RatingHistogram (avoids "two Histograms" issue) */
type HistogramProp = React.ComponentProps<typeof RatingHistogram>["histogram"];

type ReviewStats = {
  total_reviews?: number;
  rated_reviews?: number;
  avg_rating?: number | null;
  rating_histogram?: unknown; // API can be unknown → we validate before passing to RatingHistogram
  recent?: unknown;
};

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

type ReviewRecent = {
  set_num?: string;
  set_name?: string;
  rating?: number | string | null;
  text?: string | null;
  created_at?: string | null;
  createdAt?: string | null;

  image_url?: string | null;
  imageUrl?: string | null;
  set_image_url?: string | null;
  setImageUrl?: string | null;
  set_image?: string | null;
  setImage?: string | null;
};

function formatRating(rating: unknown): string {
  if (rating === null || rating === undefined) return "—";
  const n = Number(rating);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asReviewRecentArray(v: unknown): ReviewRecent[] {
  if (!Array.isArray(v)) return [];

  const out: ReviewRecent[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;

    out.push({
      set_num: asString(item.set_num),
      set_name: asString(item.set_name),
      rating: (item.rating as ReviewRecent["rating"]) ?? null,
      text: typeof item.text === "string" ? item.text : null,
      created_at: typeof item.created_at === "string" ? item.created_at : null,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : null,

      image_url: typeof item.image_url === "string" ? item.image_url : null,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
      set_image_url: typeof item.set_image_url === "string" ? item.set_image_url : null,
      setImageUrl: typeof item.setImageUrl === "string" ? item.setImageUrl : null,
      set_image: typeof item.set_image === "string" ? item.set_image : null,
      setImage: typeof item.setImage === "string" ? item.setImage : null,
    });
  }

  return out;
}

function asOwnedSetArray(v: unknown): OwnedSet[] {
  if (!Array.isArray(v)) return [];
  const out: OwnedSet[] = [];

  for (const item of v) {
    if (!isRecord(item)) continue;
    out.push({
      set_num: asString(item.set_num),
      name: asString(item.name) || undefined,
      theme: typeof item.theme === "string" ? item.theme : item.theme === null ? null : undefined,
      pieces: typeof item.pieces === "number" ? item.pieces : item.pieces === null ? null : undefined,
    });
  }

  return out;
}

function asListLiteArray(v: unknown): ListLite[] {
  if (!Array.isArray(v)) return [];
  const out: ListLite[] = [];

  for (const item of v) {
    if (!isRecord(item)) continue;
    out.push({
      id: typeof item.id === "string" || typeof item.id === "number" ? item.id : undefined,
      title: asString(item.title) || undefined,
      name: asString(item.name) || undefined,
      items_count: typeof item.items_count === "number" ? item.items_count : undefined,
      is_public: typeof item.is_public === "boolean" ? item.is_public : undefined,
    });
  }

  return out;
}

/**
 * ✅ Validate unknown into EXACT HistogramProp used by RatingHistogram
 * We accept either:
 * - Record<string, number>
 * - Array<{rating:number; count:number}>
 */
function isHistogramProp(x: unknown): x is HistogramProp {
  if (!x) return false;

  if (Array.isArray(x)) {
    return x.every((it) => {
      if (!it || typeof it !== "object") return false;
      const r = (it as { rating?: unknown }).rating;
      const c = (it as { count?: unknown }).count;
      return typeof r === "number" && Number.isFinite(r) && typeof c === "number" && Number.isFinite(c);
    });
  }

  if (typeof x === "object") {
    return Object.values(x as Record<string, unknown>).every((v) => typeof v === "number" && Number.isFinite(v));
  }

  return false;
}

function toHistogramProp(x: unknown): HistogramProp | null {
  return isHistogramProp(x) ? x : null;
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
        <div className="mt-2 text-3xl font-extrabold leading-none text-zinc-900 dark:text-zinc-50">{value}</div>
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

function RecentMiniReviewCard({ r }: { r: ReviewRecent }) {
  const setNum = String(r?.set_num || "");
  const setName = (r?.set_name && String(r.set_name)) || setNum;
  const rating = formatRating(r?.rating);
  const text = String(r?.text || "").trim();

  const imageUrl =
    r?.image_url || r?.imageUrl || r?.set_image_url || r?.setImageUrl || r?.set_image || r?.setImage || null;

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

function makeRecentKey(r: ReviewRecent, idx: number): string {
  const setNum = r.set_num || "x";
  const created = r.created_at || r.createdAt || "";
  return `${setNum}-${created || String(idx)}`;
}

export default function AccountClient() {
  const router = useRouter();
  const { token, me, logout, hydrated } = useAuth();
  const isLoggedIn = hydrated && !!token;

  const username = useMemo(() => me?.username || "Account", [me?.username]);

  const [owned, setOwned] = useState<OwnedSet[]>([]);
  const [wishlist, setWishlist] = useState<WishlistSet[]>([]);
  const [customLists, setCustomLists] = useState<ListLite[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [reviewStatsLoading, setReviewStatsLoading] = useState(false);
  const [reviewStatsErr, setReviewStatsErr] = useState("");

  const [recentEnriched, setRecentEnriched] = useState<ReviewRecent[]>([]);

  const [savedCount, setSavedCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return readSavedListIds().length;
  });

  useEffect(() => {
    const refresh = () => setSavedCount(readSavedListIds().length);

    refresh();

    const evt = savedListsEventName();
    const onStorage = () => refresh();
    const onSavedLists = () => refresh();

    window.addEventListener("storage", onStorage);
    window.addEventListener(evt, onSavedLists as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(evt, onSavedLists as EventListener);
    };
  }, []);

  const totalReviews = reviewStats?.total_reviews ?? null;
  const ratedReviews = reviewStats?.rated_reviews ?? null;
  const avgRating = reviewStats?.avg_rating ?? null;

  const recentReviewsRaw = useMemo<ReviewRecent[]>(() => {
    return asReviewRecentArray(reviewStats?.recent).slice(0, 6);
  }, [reviewStats]);

  const ownedCount = owned.length;
  const wishlistCount = wishlist.length;

  const piecesOwned = useMemo(() => {
    let total = 0;
    for (const s of owned) total += Number(s?.pieces || 0);
    return total;
  }, [owned]);

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

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      if (!hydrated) return;

      if (!isLoggedIn) {
        setOwned([]);
        setWishlist([]);
        setCustomLists([]);
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
        const [ownedData, wishlistData, custom, stats] = await Promise.all([
          apiFetch<unknown>("/collections/me/owned", { token, cache: "no-store" }),
          apiFetch<unknown>("/collections/me/wishlist", { token, cache: "no-store" }),
          apiFetch<unknown>("/lists/me?include_system=false", { token, cache: "no-store" }),
          apiFetch<unknown>("/reviews/me/stats", { token, cache: "no-store" }),
        ]);

        if (cancelled) return;

        setOwned(asOwnedSetArray(ownedData));
        setWishlist(asOwnedSetArray(wishlistData));
        setCustomLists(asListLiteArray(custom));

        if (isRecord(stats)) {
          setReviewStats({
            total_reviews: asNumber(stats.total_reviews) ?? undefined,
            rated_reviews: asNumber(stats.rated_reviews) ?? undefined,
            avg_rating: asNumber(stats.avg_rating),
            rating_histogram: stats.rating_histogram,
            recent: stats.recent,
          });
        } else {
          setReviewStats(null);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg);
        setReviewStats(null);
        setReviewStatsErr(msg);
      } finally {
        if (cancelled) return;
        setLoading(false);
        setReviewStatsLoading(false);
      }
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isLoggedIn, token]);

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
        .filter((x): x is string => Boolean(x));

      if (!need.length) {
        setRecentEnriched(recentReviewsRaw);
        return;
      }

      try {
        const qs = encodeURIComponent([...new Set(need)].join(","));
        const setsRaw = await apiFetch<unknown>(`/sets/bulk?set_nums=${qs}`, { token, cache: "no-store" });

        if (cancelled) return;

        const setsArr = Array.isArray(setsRaw) ? setsRaw : [];
        const byNum = new Map<string, Record<string, unknown>>();

        for (const s of setsArr) {
          if (!isRecord(s)) continue;
          const sn = asString(s.set_num);
          if (!sn) continue;
          byNum.set(sn, s);
        }

        const merged = recentReviewsRaw.map((r) => {
          const s = r.set_num ? byNum.get(r.set_num) : undefined;

          const imageFromSet =
            (s && typeof s.image_url === "string" && s.image_url) ||
            (s && typeof s.imageUrl === "string" && s.imageUrl) ||
            (s && typeof s.set_image_url === "string" && s.set_image_url) ||
            (s && typeof s.setImageUrl === "string" && s.setImageUrl) ||
            null;

          return {
            ...r,
            image_url: r.image_url || r.imageUrl || r.set_image_url || r.setImageUrl || imageFromSet || null,
          };
        });

        setRecentEnriched(merged);
      } catch {
        if (!cancelled) setRecentEnriched(recentReviewsRaw);
      }
    }

    void enrichRecent();
    return () => {
      cancelled = true;
    };
  }, [token, recentReviewsRaw]);

  const recentToShow = recentEnriched.length ? recentEnriched : recentReviewsRaw;

  /** ✅ FIX: this is now HistogramProp (the exact prop type) */
  const histogram = useMemo<HistogramProp | null>(() => toHistogramProp(reviewStats?.rating_histogram), [reviewStats]);

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

                    <div className="mt-2 flex flex-1 items-end justify-center overflow-hidden">
                      {histogram ? (
                        <RatingHistogram
                          histogram={histogram}
                          height={40}
                          barWidth={16}
                          gap={10}
                          showLabels={false}
                          maxWidth={420}
                          paddingY={0}
                          paddingX={0}
                        />
                      ) : (
                        <div className="text-sm text-zinc-500">No rating data yet.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold">Recent reviews</div>
                  {recentToShow.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">No recent reviews.</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-3">
                      {recentToShow.map((r, idx) => (
                        <RecentMiniReviewCard key={makeRecentKey(r, idx)} r={r} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          <section className="mt-10">
            <div className="font-semibold">Top themes (owned)</div>

            {topThemes.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No owned sets yet.</p>
            ) : (
              <div className="mt-3 grid max-w-xl gap-2">
                {topThemes.map(([theme, count]) => (
                  <ThemeRow
                    key={theme}
                    theme={theme}
                    count={count}
                    href={`/collection/owned?theme=${encodeURIComponent(theme)}`}
                  />
                ))}
              </div>
            )}
          </section>

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