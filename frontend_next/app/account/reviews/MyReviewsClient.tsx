// frontend_next/app/account/reviews/MyReviewsClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import RatingHistogram from "@/app/components/RatingHistogram";

function formatRating(rating: any) {
  if (rating === null || rating === undefined) return "—";
  const n = Number(rating);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function formatDate(iso: any) {
  if (!iso) return "";
  try {
    return new Date(String(iso)).toLocaleDateString();
  } catch {
    return "";
  }
}

function MiniStat({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
}) {
  const base = (
    <div className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
      <div className="text-xs font-extrabold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-xl font-extrabold leading-tight text-zinc-900 dark:text-zinc-50">{value}</div>
      {sub ? <div className="mt-1 text-xs font-semibold text-zinc-500">{sub}</div> : null}
    </div>
  );

  if (!href) return base;

  return (
    <Link href={href} className="block no-underline">
      {base}
    </Link>
  );
}

function MiniSetReviewCard({ r }: { r: any }) {
  const setNum = r?.set_num || "";
  const setName = r?.set_name || "Unknown set";
  const rating = formatRating(r?.rating);
  const text = String(r?.text || "").trim();
  const when = formatDate(r?.updated_at || r?.created_at);

  const imageUrl =
    r?.image_url || r?.imageUrl || r?.set_image_url || r?.setImageUrl || r?.set_image || r?.setImage || null;

  return (
    <Link
      href={`/sets/${encodeURIComponent(setNum)}`}
      className="block rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md dark:border-white/[.14] dark:bg-zinc-950"
    >
      <div className="grid grid-cols-[72px_1fr] gap-3">
        <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-xl border border-black/[.08] bg-white dark:border-white/[.14] dark:bg-zinc-950">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <div className="text-xs font-bold text-zinc-400">—</div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <div
              className="min-w-0"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as any,
                overflow: "hidden",
              }}
            >
              <div className="font-extrabold leading-tight text-zinc-900 dark:text-zinc-50">{setName}</div>
            </div>

            <div className="shrink-0 whitespace-nowrap font-extrabold text-zinc-900 dark:text-zinc-50">
              {rating} <span className="text-xs">★</span>
            </div>
          </div>

          <div className="mt-1 text-sm text-zinc-500">
            {setNum} {when ? `• ${when}` : ""}
          </div>

          {text ? (
            <div
              className="mt-2 text-sm text-zinc-700 dark:text-zinc-300"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as any,
                overflow: "hidden",
              }}
            >
              {text}
            </div>
          ) : (
            <div className="mt-2 text-sm text-zinc-400">No review text</div>
          )}
        </div>
      </div>
    </Link>
  );
}

type ReviewStats = {
  total_reviews?: number;
  rated_reviews?: number;
  avg_rating?: number;
  rating_histogram?: any;
  recent?: any[];
};

export default function MyReviewsClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { token, me, hydrated } = useAuth();

  const isLoggedIn = hydrated && !!token;
  const username = useMemo(() => {
    const anyMe = me as any;
    return (me?.username || anyMe?.email || "Account") as string;
  }, [me]);

  const filterParam = String(sp.get("filter") || "").toLowerCase();

  const [onlyRated, setOnlyRated] = useState(filterParam.includes("rated"));
  const [onlyWithText, setOnlyWithText] = useState(filterParam.includes("text"));

  useEffect(() => {
    setOnlyRated(filterParam.includes("rated"));
    setOnlyWithText(filterParam.includes("text"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParam]);

  function pushFilterParams(nextOnlyRated: boolean, nextOnlyWithText: boolean) {
    let f = "";
    if (nextOnlyRated && nextOnlyWithText) f = "rated_text";
    else if (nextOnlyRated) f = "rated";
    else if (nextOnlyWithText) f = "text";

    const next = new URLSearchParams(sp.toString());
    if (!f) next.delete("filter");
    else next.set("filter", f);

    const qs = next.toString();
    router.replace(qs ? `/account/reviews?${qs}` : "/account/reviews");
  }

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [statsErr, setStatsErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hydrated) return;

      if (!isLoggedIn) {
        setRows([]);
        setStats(null);
        setErr("");
        setStatsErr("");
        return;
      }

      setLoading(true);
      setErr("");
      setStatsErr("");

      try {
        const [reviewsData, statsData] = await Promise.all([
          apiFetch<any>("/sets/reviews/me?limit=200", { token, cache: "no-store" }),
          apiFetch<any>("/reviews/me/stats", { token, cache: "no-store" }),
        ]);

        if (cancelled) return;

        setRows(Array.isArray(reviewsData) ? reviewsData : []);
        setStats(statsData || null);
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message || String(e);
        setErr(msg);
        setStats(null);
        setStatsErr(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isLoggedIn, token]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (onlyRated && (r?.rating === null || r?.rating === undefined)) return false;
      if (onlyWithText && !String(r?.text || "").trim()) return false;
      return true;
    });
  }, [rows, onlyRated, onlyWithText]);

  const totalReviews = stats?.total_reviews ?? rows.length ?? 0;
  const ratedReviews = stats?.rated_reviews ?? null;
  const avgRating = stats?.avg_rating ?? null;

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16">
      <div className="mt-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold">My Reviews</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {isLoggedIn ? (
              <>
                Reviews by <span className="font-semibold text-zinc-900 dark:text-zinc-100">{username}</span>
              </>
            ) : (
              "Log in to see your reviews."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/account")}
            className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            ← Back to Account
          </button>
        </div>
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
          {/* Mini stats + breakdown */}
          <section className="mt-6">
            <div className="flex flex-wrap items-stretch gap-3">
              <div className="min-w-[220px] flex-1">
                <MiniStat
                  label="Total reviews"
                  value={totalReviews}
                  sub={onlyRated || onlyWithText ? "Click to clear filters" : "Click to view all"}
                  href="/account/reviews"
                />
              </div>

              <div className="min-w-[220px] flex-1">
                <MiniStat
                  label="Rated reviews"
                  value={ratedReviews == null ? "—" : ratedReviews}
                  sub={onlyRated && !onlyWithText ? "Click to clear filter" : "Click to filter"}
                  href={onlyRated && !onlyWithText ? "/account/reviews" : "/account/reviews?filter=rated"}
                />
              </div>

              <div className="min-w-[320px] flex-[2]">
                <div className="grid min-h-[70px] grid-cols-[140px_1fr] items-center gap-3 rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
                  <div className="grid gap-2">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-zinc-500">Ratings</div>
                    <div className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
                      {avgRating == null ? "—" : Number(avgRating).toFixed(2)}
                      <span className="ml-2 text-xs font-semibold text-zinc-500">avg</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    {statsErr ? (
                      <div className="text-sm text-red-600">Error loading</div>
                    ) : stats?.rating_histogram ? (
                      <RatingHistogram
                        histogram={stats.rating_histogram}
                        height={52}
                        barWidth={18}
                        gap={8}
                        showLabels={false}
                        maxWidth={420}
                      />
                    ) : (
                      <div className="text-sm text-zinc-500">Loading…</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Filters */}
          <section className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <input
                type="checkbox"
                checked={onlyRated}
                onChange={(e) => {
                  const next = e.target.checked;
                  setOnlyRated(next);
                  pushFilterParams(next, onlyWithText);
                }}
              />
              Only rated
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <input
                type="checkbox"
                checked={onlyWithText}
                onChange={(e) => {
                  const next = e.target.checked;
                  setOnlyWithText(next);
                  pushFilterParams(onlyRated, next);
                }}
              />
              Only with text
            </label>

            <div className="ml-auto text-sm font-semibold text-zinc-500">
              Showing <span className="text-zinc-900 dark:text-zinc-100">{filtered.length}</span> of{" "}
              <span className="text-zinc-900 dark:text-zinc-100">{rows.length}</span>
            </div>
          </section>

          <div className="mt-4">
            {loading ? <p className="m-0 text-sm">Loading your reviews…</p> : null}
            {err ? <p className="m-0 text-sm text-red-600">Error: {err}</p> : null}
          </div>

          {!loading && !err && filtered.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No reviews yet (or filters removed them).</p>
          ) : null}

          {!loading && !err && filtered.length > 0 ? (
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3">
              {filtered.map((r) => (
                <MiniSetReviewCard key={`${r?.set_num || ""}-${r?.created_at || r?.updated_at || ""}`} r={r} />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}