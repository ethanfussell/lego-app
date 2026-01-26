"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Head from "next/head";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard, { SetLite } from "@/app/components/SetCard";
import AddToListMenu from "@/app/components/AddToListMenu";

type Offer = {
  store?: string;
  url?: string;
  price?: number;
  currency?: string;
  in_stock?: boolean;
};

type ReviewItem = {
  id: number;
  set_num: string;
  user: string;
  rating: number | null;
  text: string | null;
  created_at: string;
  updated_at: string | null;
  likes_count: number;
  liked_by: string[];
};

type RatingSummary = {
  set_num?: string;
  average?: number | null;
  count?: number;
};

type SetDetail = {
  set_num: string;
  name?: string;
  year?: number;
  theme?: string;
  pieces?: number;
  num_parts?: number;
  image_url?: string | null;
  description?: string | null;
  status?: string | null;
  is_retired?: boolean;
  retired?: boolean;
};

type Props = {
  setNum?: string;
  initialData?: SetDetail | null;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function formatReviewDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

function toThemeSlug(themeName: unknown) {
  return encodeURIComponent(String(themeName || "").trim());
}

function computeStarsFromPointer(el: HTMLElement, clientX: number) {
  const rect = el.getBoundingClientRect();
  const x = clientX - rect.left;
  const relative = rect.width > 0 ? x / rect.width : 0;

  let value = relative * 5;
  value = Math.round(value * 2) / 2; // half-stars
  if (value < 0.5) value = 0.5;
  if (value > 5) value = 5;
  return value;
}

export default function SetDetailClient(props: Props) {
  const router = useRouter();

  // Prefer prop setNum (server-provided). Otherwise use route param.
  const params = useParams<{ setNum?: string }>();
  const routeSetNum = params?.setNum ? decodeURIComponent(String(params.setNum)) : "";
  const setNum = (props.setNum?.trim() || routeSetNum).trim();

  const { token, hydrated } = useAuth();
  const isLoggedIn = hydrated && !!token;

  const PREVIEW_SIMILAR_LIMIT = 12;

  // -------------------------------
  // Basic set state
  // -------------------------------
  const [setDetail, setSetDetail] = useState<SetDetail | null>(props.initialData ?? null);
  const [loading, setLoading] = useState<boolean>(!props.initialData);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------
  // Determine "current username"
  // -------------------------------
  const [meUsername, setMeUsername] = useState<string | null>(null);

  // -------------------------------
  // Reviews state
  // -------------------------------
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  // -------------------------------
  // Rating summary
  // -------------------------------
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [ratingSummaryLoading, setRatingSummaryLoading] = useState(false);
  const [ratingSummaryError, setRatingSummaryError] = useState<string | null>(null);

  // -------------------------------
  // "Your rating" UI state
  // -------------------------------
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  // -------------------------------
  // Review form UI
  // -------------------------------
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);

  // -------------------------------
  // Similar sets
  // -------------------------------
  const [similarSets, setSimilarSets] = useState<SetLite[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const similarRowRef = useRef<HTMLDivElement | null>(null);

  // -------------------------------
  // Shop offers
  // -------------------------------
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const shopRef = useRef<HTMLHeadingElement | null>(null);

  // -------------------------------
  // Derived review subsets
  // -------------------------------
  const myReview = useMemo(() => {
    if (!isLoggedIn || !meUsername) return null;
    return reviews.find((r) => r.user === meUsername) || null;
  }, [reviews, isLoggedIn, meUsername]);

  const visibleReviews = useMemo(() => {
    return reviews.filter((r) => r.text && String(r.text).trim() !== "");
  }, [reviews]);

  // -------------------------------
  // Optional Head fallback (server metadata is primary)
  // -------------------------------
  const headFallback = useMemo(() => {
    const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
    const url = base ? `${base}/sets/${encodeURIComponent(setNum)}` : `/sets/${encodeURIComponent(setNum)}`;

    const title =
      setDetail?.name && setNum
        ? `LEGO ${setNum} — ${setDetail.name} | YourSite`
        : setNum
        ? `LEGO ${setNum} — LEGO Set | YourSite`
        : `LEGO Set | YourSite`;

    const desc =
      setDetail?.name && setDetail?.year && (setDetail?.pieces ?? setDetail?.num_parts)
        ? `Details for LEGO set ${setNum}: ${setDetail.name}. ${setDetail.pieces ?? setDetail.num_parts} pieces · from ${setDetail.year}.`
        : setDetail?.name
        ? `Details for LEGO set ${setNum}: ${setDetail.name}.`
        : setNum
        ? `Details for LEGO set ${setNum}.`
        : `LEGO set details.`;

    const image = setDetail?.image_url || undefined;
    return { url, title, desc, image };
  }, [setNum, setDetail]);

  // -------------------------------
  // Load /users/me (only when logged in)
  // -------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (!hydrated) return;
      if (!token) {
        setMeUsername(null);
        return;
      }
      try {
        const me = await apiFetch<{ username: string }>("/users/me", { token, cache: "no-store" });
        if (!cancelled) setMeUsername(me?.username ?? null);
      } catch {
        if (!cancelled) setMeUsername(null);
      }
    }

    loadMe();
    return () => {
      cancelled = true;
    };
  }, [token, hydrated]);

  // -------------------------------
  // Scroll to shop when hash is #shop
  // -------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#shop") return;
    if (loading) return;

    const el = shopRef.current;
    if (!el) return;

    const NAV_OFFSET = 90;
    const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, [loading]);

  // -------------------------------
  // Helpers
  // -------------------------------
  async function fetchReviewsForSet(currentSetNum: string) {
    setReviewsLoading(true);
    setReviewsError(null);

    try {
      const data = await apiFetch<ReviewItem[]>(
        `/sets/${encodeURIComponent(currentSetNum)}/reviews?limit=50`,
        { token: token || undefined, cache: "no-store" }
      );
      const arr = Array.isArray(data) ? data : [];
      setReviews(arr);
      return arr;
    } catch (e: any) {
      setReviewsError(e?.message || String(e));
      setReviews([]);
      return [];
    } finally {
      setReviewsLoading(false);
    }
  }

  async function fetchRatingSummary(currentSetNum: string) {
    setRatingSummaryLoading(true);
    setRatingSummaryError(null);

    try {
      const data = await apiFetch<RatingSummary>(`/sets/${encodeURIComponent(currentSetNum)}/rating`, {
        cache: "no-store",
      });

      setAvgRating(typeof data?.average === "number" ? data.average : null);
      setRatingCount(typeof data?.count === "number" ? data.count : 0);
    } catch (e: any) {
      setRatingSummaryError(e?.message || String(e));
    } finally {
      setRatingSummaryLoading(false);
    }
  }

  // -------------------------------
  // Load set detail + reviews + summary
  // -------------------------------
  useEffect(() => {
    if (!setNum) return;

    let cancelled = false;

    async function fetchData() {
      try {
        setError(null);
        if (!props.initialData) setLoading(true);

        const detail = await apiFetch<SetDetail>(`/sets/${encodeURIComponent(setNum)}`, { cache: "no-store" });
        if (cancelled) return;
        setSetDetail(detail || null);

        const [reviewsArr] = await Promise.all([fetchReviewsForSet(setNum), fetchRatingSummary(setNum)]);
        if (cancelled) return;

        if (meUsername) {
          const mine = (reviewsArr || []).find((r) => r.user === meUsername) || null;
          setUserRating(typeof mine?.rating === "number" ? clamp(mine.rating, 0, 5) : null);
        } else {
          setUserRating(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNum, meUsername]);

  // -------------------------------
  // Fetch offers
  // -------------------------------
  useEffect(() => {
    if (!setNum) return;

    let cancelled = false;

    async function fetchOffers() {
      try {
        setOffersLoading(true);
        setOffersError(null);

        const data = await apiFetch<Offer[]>(`/sets/${encodeURIComponent(setNum)}/offers`, { cache: "no-store" });

        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => {
          const aStock = a?.in_stock ? 0 : 1;
          const bStock = b?.in_stock ? 0 : 1;
          if (aStock !== bStock) return aStock - bStock;
          const ap = typeof a?.price === "number" ? a.price : Number.POSITIVE_INFINITY;
          const bp = typeof b?.price === "number" ? b.price : Number.POSITIVE_INFINITY;
          return ap - bp;
        });

        if (!cancelled) setOffers(list);
      } catch (e: any) {
        if (!cancelled) setOffersError(e?.message || String(e));
      } finally {
        if (!cancelled) setOffersLoading(false);
      }
    }

    fetchOffers();
    return () => {
      cancelled = true;
    };
  }, [setNum]);

  // -------------------------------
  // Similar sets (by theme)
  // -------------------------------
  useEffect(() => {
    if (!setDetail?.theme) {
      setSimilarSets([]);
      return;
    }

    let cancelled = false;

    async function fetchSimilar() {
      try {
        setSimilarLoading(true);
        setSimilarError(null);

        const p = new URLSearchParams();

        const theme = setDetail?.theme ? String(setDetail.theme) : "";
        if (!theme) return; // or just skip this whole “related by theme” fetch
        
        p.set("q", theme);
        p.set("sort", "rating");
        p.set("order", "desc");
        p.set("page", "1");
        p.set("limit", "24");

        const data = await apiFetch<any>(`/sets?${p.toString()}`, { cache: "no-store" });

        let items: SetLite[] = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
        items = items.filter((s) => String(s?.set_num) !== String(setNum));

        if (!cancelled) setSimilarSets(items.slice(0, PREVIEW_SIMILAR_LIMIT));
      } catch (e: any) {
        if (!cancelled) setSimilarError(e?.message || String(e));
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    }

    fetchSimilar();
    return () => {
      cancelled = true;
    };
  }, [setDetail?.theme, setNum]);

  // -------------------------------
  // Reviews: create/update
  // -------------------------------
  async function upsertMyReview(payload: { rating: number | null; text: string | null }) {
    if (!token) {
      router.push("/login");
      throw new Error("Login required");
    }

    const created = await apiFetch<ReviewItem>(`/sets/${encodeURIComponent(setNum)}/reviews`, {
      token,
      method: "POST",
      body: payload,
    });

    if (!created) throw new Error("No response from server");

    setReviews((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const others = meUsername ? arr.filter((r) => r.user !== meUsername) : arr;
      return [created, ...others];
    });

    setUserRating(typeof created.rating === "number" ? created.rating : null);

    // keep summary fresh
    fetchRatingSummary(setNum).catch(() => {});

    return created;
  }

  function startEditMyReview() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setShowReviewForm(true);
    setReviewText(myReview?.text || "");
    setReviewSubmitError(null);
    if (typeof myReview?.rating === "number") setUserRating(myReview.rating);
  }

  // -------------------------------
  // Delete my review
  // -------------------------------
  async function deleteMyReview() {
    if (!token) {
      router.push("/login");
      return;
    }

    const ok = window.confirm("Delete your review? This will also remove your rating for this set.");
    if (!ok) return;

    try {
      setSavingRating(true);
      setRatingError(null);
      setReviewSubmitError(null);

      await apiFetch(`/sets/${encodeURIComponent(setNum)}/reviews/me`, {
        token,
        method: "DELETE",
      });

      // optimistic UI
      setUserRating(null);
      setHoverRating(null);
      setReviewText("");
      setShowReviewForm(false);
      setReviews((prev) => (meUsername ? prev.filter((r) => r.user !== meUsername) : prev));

      // authoritative refresh
      await Promise.all([fetchReviewsForSet(setNum), fetchRatingSummary(setNum)]);

      // (optional) if you want a hard refresh of the route:
      // router.refresh();
    } catch (e: any) {
      setRatingError(e?.message || String(e));
    } finally {
      setSavingRating(false);
    }
  }

  // -------------------------------
  // Save rating-only (text null)
  // -------------------------------
  async function saveRating(newRating: number) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    try {
      setSavingRating(true);
      setRatingError(null);
      await upsertMyReview({ rating: Number(newRating), text: null });
    } catch (e: any) {
      setRatingError(e?.message || String(e));
    } finally {
      setSavingRating(false);
    }
  }

  async function handleStarClick(value: number) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    if (userRating != null && Number(userRating) === Number(value)) {
      await deleteMyReview();
      return;
    }

    setUserRating(value);
    await saveRating(value);
  }

  // -------------------------------
  // Review submit
  // -------------------------------
  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    if (!reviewText.trim() && userRating == null) {
      setReviewSubmitError("Please provide a rating, some text, or both.");
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewSubmitError(null);

      await upsertMyReview({
        rating: userRating == null ? null : Number(userRating),
        text: reviewText.trim() || null,
      });

      setReviewText("");
      setShowReviewForm(false);
    } catch (e: any) {
      setReviewSubmitError(e?.message || String(e));
    } finally {
      setReviewSubmitting(false);
    }
  }

  // -------------------------------
  // Similar row scrolling
  // -------------------------------
  function scrollSimilar(direction: number) {
    const node = similarRowRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * 240, behavior: "smooth" });
  }

  // -------------------------------
  // Loading / error / not found
  // -------------------------------
  if (!setNum) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-red-600">Missing set number in the URL.</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 rounded-full border border-black/[.10] px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
        >
          Go home
        </button>
      </div>
    );
  }

  if (loading) return <p className="mx-auto max-w-5xl px-6 py-10 text-sm">Loading set…</p>;

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-red-600">Error: {error}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-full border border-black/[.10] px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (!setDetail) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm">Set not found.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-full border border-black/[.10] px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
        >
          ← Back
        </button>
      </div>
    );
  }

  const { name, year, theme, pieces, num_parts, image_url, description } = setDetail;
  const parts = typeof num_parts === "number" ? num_parts : pieces;

  const isRetired = setDetail.status === "retired" || setDetail.is_retired === true || setDetail.retired === true;

  // -------------------------------
  // Render
  // -------------------------------
  return (
    <div className="mx-auto max-w-5xl px-6 pb-16">
      <Head>
        <link rel="canonical" href={headFallback.url} />
        <meta property="og:url" content={headFallback.url} />
        <meta property="og:title" content={headFallback.title} />
        <meta property="og:description" content={headFallback.desc} />
        {headFallback.image ? <meta property="og:image" content={headFallback.image} /> : null}
        <meta name="twitter:card" content={headFallback.image ? "summary_large_image" : "summary" } />
        <meta name="twitter:title" content={headFallback.title} />
        <meta name="twitter:description" content={headFallback.desc} />
        {headFallback.image ? <meta name="twitter:image" content={headFallback.image} /> : null}
      </Head>

      <button
        onClick={() => router.back()}
        className="mt-8 rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
      >
        ← Back
      </button>

      {/* HERO */}
      <section className="mt-6 grid gap-8 md:grid-cols-[360px_1fr]">
        {/* image */}
        <div className="max-w-[360px]">
          <div className="grid min-h-[260px] place-items-center rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.14] dark:bg-zinc-950">
            {image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image_url} alt={name || setNum} className="block max-h-[320px] w-full object-contain" />
            ) : (
              <div className="grid w-full place-items-center rounded-xl bg-zinc-100 py-24 text-sm text-zinc-500 dark:bg-zinc-900">
                No image available
              </div>
            )}
          </div>
        </div>

        {/* meta */}
        <div>
          <h1 className="m-0 text-2xl font-semibold">{name || "Unknown set"}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{setNum}</span>
            {year ? ` • ${year}` : ""}
          </p>

          {theme ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-500">Theme:</span>{" "}
              <Link href={`/themes/${toThemeSlug(theme)}`} className="font-semibold hover:underline">
                {theme}
              </Link>
            </p>
          ) : null}

          {typeof parts === "number" ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{parts} pieces</p> : null}

          {isRetired ? <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-400">⏳ This set is retired</p> : null}

          {(ratingSummaryLoading || ratingSummaryError || ratingCount > 0) ? (
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
              ⭐{" "}
              <span className="font-semibold">
                {ratingSummaryLoading ? "Loading…" : avgRating !== null ? avgRating.toFixed(1) : "—"}
              </span>{" "}
              {ratingSummaryError ? (
                <span className="text-red-600">(error loading ratings)</span>
              ) : (
                <span className="text-zinc-500">
                  ({ratingCount === 0 ? "no ratings yet" : `${ratingCount} rating${ratingCount === 1 ? "" : "s"}`})
                </span>
              )}
            </p>
          ) : null}

          {/* actions */}
          <section className="mt-4 rounded-2xl border border-black/[.08] bg-zinc-50 p-4 dark:border-white/[.14] dark:bg-zinc-950">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-[220px]">
                <AddToListMenu token={token || ""} setNum={setNum} />
              </div>
            </div>

            {/* Your rating */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Your rating:</span>

              <div
                className="relative inline-block cursor-pointer select-none text-3xl leading-none"
                style={{ opacity: savingRating ? 0.7 : 1 }}
                onMouseMove={(e) => {
                  if (!isLoggedIn || savingRating) return;
                  setHoverRating(computeStarsFromPointer(e.currentTarget, e.clientX));
                }}
                onMouseLeave={() => setHoverRating(null)}
                onClick={async (e) => {
                  if (!isLoggedIn || savingRating) {
                    router.push("/login");
                    return;
                  }
                  const value = computeStarsFromPointer(e.currentTarget, e.clientX);
                  await handleStarClick(value);
                }}
              >
                <div className="text-zinc-300 dark:text-zinc-700">★★★★★</div>
                <div
                  className="pointer-events-none absolute left-0 top-0 overflow-hidden whitespace-nowrap text-amber-500"
                  style={{ width: `${(((hoverRating ?? userRating) || 0) / 5) * 100}%` }}
                >
                  ★★★★★
                </div>
              </div>

              {userRating != null ? <span className="text-sm text-zinc-600 dark:text-zinc-400">{Number(userRating).toFixed(1)}</span> : null}
              {ratingError ? <span className="text-sm text-red-600">{ratingError}</span> : null}
            </div>

            {/* Review toggle */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!isLoggedIn) {
                    router.push("/login");
                    return;
                  }
                  if (!showReviewForm && myReview) startEditMyReview();
                  else setShowReviewForm((v) => !v);
                }}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-white dark:text-black"
              >
                {showReviewForm ? "Cancel review" : myReview ? "✏️ Edit your review" : "✍️ Leave a review"}
              </button>

              {!isLoggedIn ? <span className="text-sm text-zinc-500">Log in to rate or review this set.</span> : null}
            </div>
          </section>
        </div>
      </section>

      {/* ABOUT */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">About this set</h2>
        {description ? (
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{description}</p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">No description available yet.</p>
        )}

        <ul className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          {theme ? (
            <li>
              <span className="font-semibold text-zinc-500">Theme:</span>{" "}
              <Link href={`/themes/${toThemeSlug(theme)}`} className="font-semibold hover:underline">
                {theme}
              </Link>
            </li>
          ) : null}
          {year ? (
            <li>
              <span className="font-semibold text-zinc-500">Year:</span> {year}
            </li>
          ) : null}
          {typeof parts === "number" ? (
            <li>
              <span className="font-semibold text-zinc-500">Pieces:</span> {parts}
            </li>
          ) : null}
          <li>
            <span className="font-semibold text-zinc-500">Status:</span> {isRetired ? "Retired" : "Available"}
          </li>
        </ul>
      </section>

      {/* SHOP */}
      <section id="shop" className="mt-10">
        <h2 ref={shopRef} className="scroll-mt-24 text-lg font-semibold">
          Shop & price comparison
        </h2>

        <div className="mt-3 rounded-2xl border border-black/[.08] bg-zinc-50 p-4 dark:border-white/[.14] dark:bg-zinc-950">
          {offersLoading ? <p className="text-sm">Loading offers…</p> : null}
          {!offersLoading && offersError ? <p className="text-sm text-red-600">Error: {offersError}</p> : null}
          {!offersLoading && !offersError && offers.length === 0 ? (
            <p className="text-sm text-zinc-500">No offers yet. (We’ll add more stores soon.)</p>
          ) : null}

          {!offersLoading && !offersError && offers.length > 0 ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {offers.map((o, idx) => {
                const price =
                  typeof o?.price === "number"
                    ? `${o.price.toFixed(2)}${o.currency ? ` ${o.currency}` : ""}`
                    : "—";
                const bestBadge = idx === 0 ? "Best price" : null;

                return (
                  <li
                    key={`${o.store}-${o.url}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-black/[.08] bg-white px-4 py-3 dark:border-white/[.14] dark:bg-zinc-950"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{o.store || "Store"}</div>
                        {bestBadge ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                            {bestBadge}
                          </span>
                        ) : null}
                        {o?.in_stock === false ? (
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Out of stock</span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{price}</div>
                    </div>

                    {o.url ? (
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-white dark:text-black"
                        style={{ opacity: o?.in_stock === false ? 0.65 : 1 }}
                      >
                        Shop →
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </section>

      {/* REVIEWS */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">Reviews</h2>

        {showReviewForm ? (
          <form
            onSubmit={handleReviewSubmit}
            className="mt-3 rounded-2xl border border-black/[.08] bg-zinc-50 p-4 dark:border-white/[.14] dark:bg-zinc-950"
          >
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What did you think of this set?"
              className="w-full rounded-xl border border-black/[.10] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[.14] dark:bg-zinc-950 dark:focus:ring-white/10"
              rows={4}
              disabled={reviewSubmitting}
            />

            {reviewSubmitError ? <p className="mt-2 text-sm text-red-600">{reviewSubmitError}</p> : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={reviewSubmitting}
                className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {reviewSubmitting ? "Saving…" : myReview ? "Save changes" : "Post review"}
              </button>

              {myReview ? (
                <button
                  type="button"
                  onClick={deleteMyReview}
                  disabled={reviewSubmitting || savingRating}
                  className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60 dark:border-red-900/40 dark:bg-transparent dark:text-red-300"
                >
                  Delete review
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {reviewsLoading ? <p className="mt-3 text-sm">Loading reviews…</p> : null}
        {reviewsError ? <p className="mt-3 text-sm text-red-600">Error loading reviews: {reviewsError}</p> : null}

        {!reviewsLoading && !reviewsError && visibleReviews.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No reviews yet. Be the first!</p>
        ) : null}

        {!reviewsLoading && !reviewsError && visibleReviews.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {visibleReviews.map((r) => {
              const isMine = isLoggedIn && meUsername && r.user === meUsername;
              const when = formatReviewDate(r.created_at);

              return (
                <li
                  key={String(r.id)}
                  className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.14] dark:bg-zinc-950"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{r.user}</span>
                      {when ? <span className="ml-2 font-semibold text-zinc-500">• {when}</span> : null}
                    </div>

                    <div className="flex items-center gap-2">
                      {typeof r.rating === "number" ? (
                        <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                          {r.rating.toFixed(1)} ★
                        </div>
                      ) : null}

                      {isMine ? (
                        <>
                          <button
                            type="button"
                            onClick={startEditMyReview}
                            className="rounded-full border border-black/[.10] bg-white px-3 py-1 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={deleteMyReview}
                            className="rounded-full border border-red-200 bg-white px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/20"
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {r.text ? <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{r.text}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {/* SIMILAR */}
      {(similarLoading || similarError || similarSets.length > 0) ? (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Similar sets you might like</h2>

          {similarLoading ? <p className="mt-3 text-sm">Loading similar sets…</p> : null}
          {similarError ? <p className="mt-3 text-sm text-red-600">Error loading similar sets: {similarError}</p> : null}

          {!similarLoading && !similarError && similarSets.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No similar sets found yet.</p>
          ) : null}

          {!similarLoading && !similarError && similarSets.length > 0 ? (
            <div className="relative mt-4">
              <div ref={similarRowRef} className="overflow-x-auto pb-2">
                <ul className="m-0 flex list-none gap-3 p-0">
                  {similarSets.map((s) => (
                    <li key={s.set_num} className="w-[220px] shrink-0">
                      <SetCard set={s} />
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => scrollSimilar(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full border border-black/[.10] bg-white px-2 py-1 text-sm font-semibold shadow-sm hover:bg-black/[.04] dark:border-white/[.16] dark:bg-zinc-950 dark:hover:bg-white/[.06]"
              >
                ←
              </button>

              <button
                type="button"
                onClick={() => scrollSimilar(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full border border-black/[.10] bg-white px-2 py-1 text-sm font-semibold shadow-sm hover:bg-black/[.04] dark:border-white/[.16] dark:bg-zinc-950 dark:hover:bg-white/[.06]"
              >
                →
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}