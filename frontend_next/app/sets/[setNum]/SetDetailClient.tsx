// frontend_next/app/sets/[setNum]/SetDetailClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { asTrimmedString, isRecord } from "@/lib/types";

import { apiFetch, APIError } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard, { type SetLite } from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import AddToListMenu from "@/app/components/AddToListMenu";
import { useCollectionStatus, notifyCollectionChanged } from "@/lib/useCollectionStatus";
import OffersSection, { type Offer as UiOffer } from "@/app/components/OffersSection";
import EmailCapture from "@/app/components/EmailCapture";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import RatingHistogram from "@/app/components/RatingHistogram";
import { themeToSlug } from "@/lib/slug";
import { heroImageSizes, IMAGE_QUALITY } from "@/lib/image";
import { useToast } from "@/app/ui-providers/ToastProvider";
import { SetGridSkeleton, ReviewListSkeleton, DetailPageSkeleton } from "@/app/components/Skeletons";
import ErrorState from "@/app/components/ErrorState";
import AdSlot from "@/app/components/AdSlot";

// CTA experiment (CTA #2 after offers)
import { ctaClick, ctaComplete, ctaImpression } from "@/lib/events";
import { gaEvent } from "@/lib/ga";
import { variantFromKey, variantFromQuery, type Variant } from "@/lib/ab";

function normalizeUsername(raw: unknown): string | null {
  return asTrimmedString(raw);
}

type ReviewItem = {
  id: number;
  set_num: string;
  user: string;
  rating: number | null;
  text: string | null;
  created_at: string;
  updated_at: string | null;
  upvotes: number;
  downvotes: number;
  user_vote: string | null; // "up", "down", or null
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


// Backend offer shape (flexible)
type ApiOffer = {
  id?: string;
  retailer?: string;
  store?: string;
  url: string;
  price_cents?: number;
  price?: number; // legacy (dollars)
  currency?: string;
  currency_code?: string;
  in_stock?: boolean | null;
  shipping?: string | null;
  updated_at?: string | null;
} & Record<string, unknown>;

type AvailabilitySummary = {
  status: "available" | "retiring_soon" | "retired" | "unknown";
  best_offer_id?: string | null;
  updated_at?: string | null;
};

type SetOffers = {
  set_num: string;
  summary: AvailabilitySummary;
  offers: ApiOffer[];
};

type Props = {
  setNum?: string;
  initialData?: SetDetail | null;
  initialOffers?: UiOffer[];
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function formatPrice(price?: number, currency?: string): string | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function formatReviewDate(value?: string | null) {
  const s = asTrimmedString(value);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(d);
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

function isSetLite(x: unknown): x is SetLite {
  if (typeof x !== "object" || x === null) return false;
  const sn = (x as { set_num?: unknown }).set_num;
  return typeof sn === "string" && sn.trim() !== "";
}

function normalizeSetLiteArray(data: unknown): SetLite[] {
  if (Array.isArray(data)) return data.filter(isSetLite);
  if (typeof data === "object" && data !== null) {
    const results = (data as { results?: unknown }).results;
    return Array.isArray(results) ? results.filter(isSetLite) : [];
  }
  return [];
}

function pickBestOfferId(offers: ApiOffer[]): string | null {
  const priced = offers
    .map((o) => ({
      id: typeof o.id === "string" ? o.id : null,
      price_cents: typeof o.price_cents === "number" && Number.isFinite(o.price_cents) ? o.price_cents : null,
    }))
    .filter((x) => x.id);

  const withPrice = priced.filter((x) => typeof x.price_cents === "number") as Array<{ id: string; price_cents: number }>;
  if (withPrice.length) {
    withPrice.sort((a, b) => a.price_cents - b.price_cents);
    return withPrice[0]?.id ?? null;
  }

  return priced[0]?.id ?? null;
}

function isUiOffer(x: UiOffer | null): x is UiOffer {
  return x !== null;
}

function toUiOffers(apiOffers: ApiOffer[]): UiOffer[] {
  const arr = Array.isArray(apiOffers) ? apiOffers : [];

  return arr
    .map((o): UiOffer | null => {
      const url = typeof o.url === "string" ? o.url.trim() : "";
      if (!url) return null;

      const store =
        (typeof o.retailer === "string" && o.retailer.trim()) ||
        (typeof o.store === "string" && o.store.trim()) ||
        undefined;

      const currency =
        (typeof o.currency === "string" && o.currency.trim()) ||
        (typeof o.currency_code === "string" && o.currency_code.trim()) ||
        undefined;

      const price =
        typeof o.price_cents === "number" && Number.isFinite(o.price_cents)
          ? o.price_cents / 100
          : typeof o.price === "number" && Number.isFinite(o.price)
            ? o.price
            : undefined;

      const in_stock = typeof o.in_stock === "boolean" ? o.in_stock : o.in_stock == null ? null : Boolean(o.in_stock);

      const updated_at = typeof o.updated_at === "string" && o.updated_at.trim() ? o.updated_at.trim() : null;

      return { url, store, currency, price, in_stock, updated_at };
    })
    .filter(isUiOffer);
}

function HeroImage({
  src,
  alt,
  sizes,
  quality,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  quality: number;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="h-auto w-full object-contain"
        style={{ width: "100%", height: "auto" }}
        loading="eager"
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={720}
      height={540}
      sizes={sizes}
      quality={quality}
      priority={priority}
      placeholder="empty"
      className="h-auto w-full object-contain"
      style={{ width: "100%", height: "auto" }}
      onError={() => setFailed(true)}
    />
  );
}

export default function SetDetailClient(props: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const params = useParams();
  const routeSetNumRaw = (params as Record<string, string | string[] | undefined>)?.setNum;
  const routeSetNum = Array.isArray(routeSetNumRaw)
    ? decodeURIComponent(routeSetNumRaw[0] || "")
    : decodeURIComponent(routeSetNumRaw || "");

  const setNum = (asTrimmedString(props.setNum) ?? asTrimmedString(routeSetNum) ?? "").trim();

  const { token, hydrated } = useAuth();
  const toast = useToast();
  const { isOwned, isWishlist } = useCollectionStatus();
  const isLoggedIn = hydrated && typeof token === "string" && token.trim().length > 0;

  const PREVIEW_SIMILAR_LIMIT = 12;

  // CTA variant (A/B) per set, overridable by ?cta=A|B
  const ctaVariant: Variant = useMemo(() => {
    const forced = variantFromQuery(sp.get("cta"));
    return forced ?? variantFromKey(setNum || "set");
  }, [sp, setNum]);

  // fire CTA impressions once per (cta_id,set,variant)
  const ctaSeenRef = useRef<Record<string, true>>({});

  // Email capture reveal state for CTA #2
  const [showAlerts, setShowAlerts] = useState(false);
  const alertsRef = useRef<HTMLDivElement | null>(null);

  // Basic set state
  const [setDetail, setSetDetail] = useState<SetDetail | null>(props.initialData ?? null);
  const [loading, setLoading] = useState<boolean>(!props.initialData);
  const [error, setError] = useState<string | null>(null);

  // Offers
  const [offersData, setOffersData] = useState<SetOffers | null>(() => {
    const initial = Array.isArray(props.initialOffers) ? props.initialOffers : [];
    if (initial.length === 0) return null;

    const offers: ApiOffer[] = initial.map((o) => ({
      url: o.url,
      store: o.store,
      retailer: o.store,
      price: o.price,
      currency: o.currency,
      in_stock: o.in_stock ?? null,
      updated_at: typeof o.updated_at === "string" ? o.updated_at : null,
    }));

    return {
      set_num: (asTrimmedString(props.setNum) ?? asTrimmedString(routeSetNum) ?? "").trim(),
      summary: { status: "unknown", best_offer_id: null, updated_at: null },
      offers,
    };
  });

  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);

  // current username
  const [meUsername, setMeUsername] = useState<string | null>(null);

  // Reviews state
  type ReviewSortKey = "newest" | "oldest" | "highest" | "lowest";
  const [reviewSort, setReviewSort] = useState<ReviewSortKey>("newest");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  // Rating summary
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [ratingSummaryLoading, setRatingSummaryLoading] = useState(false);
  const [ratingSummaryError, setRatingSummaryError] = useState<string | null>(null);

  // "Your rating" UI state
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  // Review form UI
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);

  // Share button
  const [shareCopied, setShareCopied] = useState(false);

  // Deal alerts
  const [hasAlert, setHasAlert] = useState(false);
  const [alertId, setAlertId] = useState<number | null>(null);
  const [alertLoading, setAlertLoading] = useState(false);

  // Report review
  const [reportingReviewId, setReportingReviewId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState<string>("spam");
  const [reportNotes, setReportNotes] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Similar sets
  const [similarSets, setSimilarSets] = useState<SetLite[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const similarRowRef = useRef<HTMLDivElement | null>(null);

  const myReview = useMemo(() => {
    if (!isLoggedIn || !meUsername) return null;
    return reviews.find((r) => r.user === meUsername) || null;
  }, [reviews, isLoggedIn, meUsername]);

  const visibleReviews = useMemo(() => {
    const filtered = reviews.filter((r) => asTrimmedString(r.text));
    return [...filtered].sort((a, b) => {
      switch (reviewSort) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "highest":
          return (b.rating ?? 0) - (a.rating ?? 0);
        case "lowest":
          return (a.rating ?? 0) - (b.rating ?? 0);
        default:
          return 0;
      }
    });
  }, [reviews, reviewSort]);

  const uiOffers: UiOffer[] = useMemo(() => toUiOffers(offersData?.offers ?? []), [offersData?.offers]);

  const bestPrice = useMemo(() => {
    const priced = uiOffers
      .filter((o) => typeof o.price === "number" && Number.isFinite(o.price))
      .sort((a, b) => (a.price as number) - (b.price as number));
    if (priced.length === 0) return null;
    return { price: priced[0].price as number, currency: priced[0].currency };
  }, [uiOffers]);

  const ratingHistogram: Record<string, number> | null = useMemo(() => {
    const withRating = reviews.filter((r) => typeof r.rating === "number" && Number.isFinite(r.rating));
    if (withRating.length === 0) return null;
    const bins: Record<string, number> = {};
    for (const r of withRating) {
      const rounded = Math.round((r.rating as number) * 2) / 2;
      bins[rounded.toFixed(1)] = (bins[rounded.toFixed(1)] || 0) + 1;
    }
    return bins;
  }, [reviews]);

  // CTA #2 impression only (after offers)
  useEffect(() => {
    if (!setNum) return;

    const key = `after_offers_alerts:${setNum}:${ctaVariant}`;
    if (ctaSeenRef.current[key]) return;
    ctaSeenRef.current[key] = true;

    ctaImpression({
      cta_id: "after_offers_alerts",
      placement: "after_offers",
      variant: ctaVariant,
      set_num: setNum,
    });
  }, [setNum, ctaVariant]);

  // Load /users/me (only when logged in)
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
        if (!cancelled) setMeUsername(asTrimmedString(me?.username));
      } catch {
        if (!cancelled) setMeUsername(null);
      }
    }

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, [token, hydrated]);

  // Scroll to shop when URL has ?focus=shop OR #shop
  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;

    const focus = sp.get("focus");
    const wantsShop = focus === "shop" || window.location.hash === "#shop";
    if (!wantsShop) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const t = window.setTimeout(() => {
      const el = document.getElementById("shop");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    return () => window.clearTimeout(t);
  }, [sp, loading]);

  async function fetchReviewsForSet(currentSetNum: string) {
    setReviewsLoading(true);
    setReviewsError(null);

    try {
      const data = await apiFetch<ReviewItem[]>(`/sets/${encodeURIComponent(currentSetNum)}/reviews?limit=50`, {
        token: token || undefined,
        cache: "no-store",
      });
      const arr = Array.isArray(data) ? data : [];
      setReviews(arr);
      return arr;
    } catch (e: unknown) {
      setReviewsError(errorMessage(e));
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
    } catch (e: unknown) {
      setRatingSummaryError(errorMessage(e));
    } finally {
      setRatingSummaryLoading(false);
    }
  }

  async function fetchOffers(currentSetNum: string, status: AvailabilitySummary["status"]) {
    setOffersLoading(true);
    setOffersError(null);

    const fallbackStatus: AvailabilitySummary["status"] = status === "retired" ? "retired" : "unknown";

    try {
      const data = await apiFetch<unknown>(`/sets/${encodeURIComponent(currentSetNum)}/offers`, { cache: "no-store" });

      // New shape: { set_num, summary, offers }
      if (isRecord(data) && Array.isArray((data as { offers?: unknown }).offers)) {
        const d = data as Record<string, unknown>;
        const offers = (d.offers as unknown[]).filter(isRecord) as ApiOffer[];

        const summaryRaw = isRecord(d.summary) ? (d.summary as Record<string, unknown>) : {};

        const best_offer_id =
          typeof summaryRaw.best_offer_id === "string" ? summaryRaw.best_offer_id : pickBestOfferId(offers);

        const backendStatus = typeof summaryRaw.status === "string" ? summaryRaw.status : null;
        const computedStatus: AvailabilitySummary["status"] =
          backendStatus === "available" ||
          backendStatus === "retiring_soon" ||
          backendStatus === "retired" ||
          backendStatus === "unknown"
            ? backendStatus
            : offers.length === 0 && status !== "retired"
              ? "unknown"
              : status;

        setOffersData({
          set_num: currentSetNum,
          summary: {
            status: computedStatus,
            best_offer_id,
            updated_at: typeof summaryRaw.updated_at === "string" ? summaryRaw.updated_at : null,
          },
          offers,
        });
        return;
      }

      // Legacy: Offer[]
      const arr = Array.isArray(data) ? data : [];
      const offers = arr.filter(isRecord) as ApiOffer[];

      setOffersData({
        set_num: currentSetNum,
        summary: {
          status: offers.length === 0 && status !== "retired" ? "unknown" : status,
          best_offer_id: pickBestOfferId(offers),
          updated_at: null,
        },
        offers,
      });
    } catch (e: unknown) {
      setOffersData({
        set_num: currentSetNum,
        summary: { status: fallbackStatus, best_offer_id: null, updated_at: null },
        offers: [],
      });
      setOffersError(errorMessage(e));
    } finally {
      setOffersLoading(false);
    }
  }

  useEffect(() => {
    const initial = Array.isArray(props.initialOffers) ? props.initialOffers : [];
    if (initial.length === 0) return;

    if (offersData?.set_num === setNum && (offersData.offers?.length ?? 0) > 0) return;

    const offers: ApiOffer[] = initial.map((o) => ({
      url: o.url,
      store: o.store,
      retailer: o.store,
      price: o.price,
      currency: o.currency,
      in_stock: o.in_stock ?? null,
      updated_at: typeof o.updated_at === "string" ? o.updated_at : null,
    }));

    setOffersData({
      set_num: setNum || "",
      summary: { status: "unknown", best_offer_id: null, updated_at: null },
      offers,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNum]);

  // Load set detail + reviews + rating + offers
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

        const retired = detail?.status === "retired" || detail?.is_retired === true || detail?.retired === true;
        const status: AvailabilitySummary["status"] = retired ? "retired" : "unknown";

        const [reviewsArr] = await Promise.all([
          fetchReviewsForSet(setNum),
          fetchRatingSummary(setNum),
          fetchOffers(setNum, status),
        ]);

        if (cancelled) return;

        if (meUsername) {
          const mine = (reviewsArr || []).find((r) => r.user === meUsername) || null;
          setUserRating(typeof mine?.rating === "number" ? clamp(mine.rating, 0, 5) : null);
        } else {
          setUserRating(null);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNum, meUsername]);

  // Similar sets (by theme)
  useEffect(() => {
    const themeName = typeof setDetail?.theme === "string" ? setDetail.theme.trim() : "";

    if (!themeName) {
      setSimilarSets([]);
      setSimilarError(null);
      setSimilarLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchSimilar() {
      try {
        setSimilarLoading(true);
        setSimilarError(null);

        const p = new URLSearchParams();
        p.set("page", "1");
        p.set("limit", "24");
        p.set("sort", "relevance");
        p.set("order", "desc");

        const path = `/themes/${encodeURIComponent(themeName)}/sets?${p.toString()}`;

        const data = await apiFetch<unknown>(path, { cache: "no-store" });
        const items = normalizeSetLiteArray(data);
        const filtered = items.filter((s) => String(s?.set_num) !== String(setNum));

        if (!cancelled) setSimilarSets(filtered.slice(0, PREVIEW_SIMILAR_LIMIT));
      } catch (e: unknown) {
        if (e instanceof APIError && e.status === 404) {
          if (!cancelled) {
            setSimilarSets([]);
            setSimilarError(null);
          }
          return;
        }
        if (!cancelled) setSimilarError(errorMessage(e));
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    }

    void fetchSimilar();
    return () => {
      cancelled = true;
    };
  }, [setDetail?.theme, setNum]);

  // Check if user has a deal alert for this set
  useEffect(() => {
    if (!token || !setNum) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ has_alert: boolean; id?: number }>(
          `/alerts/me/${encodeURIComponent(setNum)}`,
          { token }
        );
        if (!cancelled) {
          setHasAlert(data.has_alert);
          setAlertId(data.id ?? null);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [token, setNum]);

  async function toggleAlert() {
    if (!token || alertLoading) return;
    setAlertLoading(true);
    try {
      if (hasAlert && alertId) {
        await apiFetch(`/alerts/${alertId}`, { method: "DELETE", token });
        setHasAlert(false);
        setAlertId(null);
        toast.push("Alert removed", { type: "default" });
      } else {
        const data = await apiFetch<{ id: number }>("/alerts", {
          method: "POST",
          token,
          body: { set_num: setNum, alert_type: "price_drop" },
        });
        setHasAlert(true);
        setAlertId(data.id);
        toast.push("You'll be notified of price drops!", { type: "success" });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("alert_already_exists")) {
        setHasAlert(true);
        toast.push("Alert already set", { type: "default" });
      } else {
        toast.push(msg || "Failed to update alert", { type: "error" });
      }
    } finally {
      setAlertLoading(false);
    }
  }

  // Reviews: create/update
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
    void fetchRatingSummary(setNum);
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

      await apiFetch(`/sets/${encodeURIComponent(setNum)}/reviews/me`, { token, method: "DELETE" });

      setUserRating(null);
      setHoverRating(null);
      setReviewText("");
      setShowReviewForm(false);
      setReviews((prev) => (meUsername ? prev.filter((r) => r.user !== meUsername) : prev));

      await Promise.all([fetchReviewsForSet(setNum), fetchRatingSummary(setNum)]);
      toast.push("Review deleted", { type: "success" });
    } catch (e: unknown) {
      setRatingError(errorMessage(e));
    } finally {
      setSavingRating(false);
    }
  }

  async function saveRating(newRating: number) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    try {
      setSavingRating(true);
      setRatingError(null);
      await upsertMyReview({ rating: Number(newRating), text: null });
      notifyCollectionChanged();
      toast.push("Rating saved", { type: "success" });
    } catch (e: unknown) {
      setRatingError(errorMessage(e));
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

      notifyCollectionChanged();
      setReviewText("");
      setShowReviewForm(false);
      toast.push("Review saved", { type: "success" });
    } catch (e: unknown) {
      const msg = errorMessage(e);
      if (msg.includes("inappropriate_language")) {
        setReviewSubmitError("Your review contains inappropriate language. Please revise and try again.");
      } else {
        setReviewSubmitError(msg);
      }
    } finally {
      setReviewSubmitting(false);
    }
  }

  function scrollSimilar(direction: number) {
    const node = similarRowRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * 240, behavior: "smooth" });
  }

  async function handleVote(reviewId: number, voteType: "up" | "down") {
    if (!token) return;

    // Optimistic update
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id !== reviewId) return r;
        const wasVoted = r.user_vote === voteType;
        return {
          ...r,
          upvotes: voteType === "up"
            ? (wasVoted ? r.upvotes - 1 : r.upvotes + 1)
            : (r.user_vote === "up" ? r.upvotes - 1 : r.upvotes),
          downvotes: voteType === "down"
            ? (wasVoted ? r.downvotes - 1 : r.downvotes + 1)
            : (r.user_vote === "down" ? r.downvotes - 1 : r.downvotes),
          user_vote: wasVoted ? null : voteType,
        };
      })
    );

    try {
      await apiFetch(`/sets/${encodeURIComponent(setNum)}/reviews/${reviewId}/vote`, {
        method: "POST",
        token,
        body: { vote_type: voteType },
      });
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Vote failed", { type: "error" });
      // Re-fetch reviews to restore correct state
      try {
        const fresh = await apiFetch<ReviewItem[]>(`/sets/${encodeURIComponent(setNum)}/reviews`, { token });
        if (Array.isArray(fresh)) setReviews(fresh);
      } catch { /* ignore */ }
    }
  }

  async function handleReportSubmit(reviewId: number) {
    if (!token || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await apiFetch("/reports", {
        method: "POST",
        token,
        body: {
          target_type: "review",
          target_id: reviewId,
          reason: reportReason,
          notes: reportNotes.trim() || null,
        },
      });
      toast.push("Report submitted", { type: "success" });
      setReportingReviewId(null);
      setReportReason("spam");
      setReportNotes("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("409") || msg.includes("already_reported")) {
        toast.push("You've already reported this review", { type: "error" });
        setReportingReviewId(null);
      } else if (msg.includes("cannot_report_own")) {
        toast.push("You can't report your own review", { type: "error" });
        setReportingReviewId(null);
      } else {
        toast.push(msg || "Failed to submit report", { type: "error" });
      }
    } finally {
      setReportSubmitting(false);
    }
  }

  // ---- Render guards ----

  if (!setNum) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-red-600">Missing set number in the URL.</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          Go home
        </button>
      </div>
    );
  }

  if (loading) return <div className="mx-auto max-w-5xl px-6 py-10"><DetailPageSkeleton /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Themes", href: "/themes" },
            ...(setDetail?.theme ? [{ label: String(setDetail.theme), href: `/themes/${themeToSlug(setDetail.theme)}` }] : []),
            { label: setNum || "Set" },
          ]}
        />

        <ErrorState message={error} onRetry={() => window.location.reload()} />

        <div className="mt-2 text-center">
          <button
            onClick={() => router.back()}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (!setDetail) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Themes", href: "/themes" },
            { label: setNum || "Set not found" },
          ]}
        />
        <p className="mt-4 text-sm">Set not found.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          ← Back
        </button>
      </div>
    );
  }

  const { name, year, theme, pieces, num_parts, image_url, description } = setDetail;
  const parts = typeof num_parts === "number" ? num_parts : pieces;
  const heroImgSrc = asTrimmedString(image_url);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Themes", href: "/themes" },
            ...(theme ? [{ label: String(theme), href: `/themes/${themeToSlug(theme)}` }] : []),
            { label: name || setNum },
          ]}
        />
      </div>

      {/* HERO */}
      <section className="mt-8 grid gap-8 md:grid-cols-[360px_1fr]">
        <div className="max-w-[360px]">
          <div className="grid min-h-[260px] place-items-center rounded-2xl border border-zinc-200 bg-white p-5">
            {heroImgSrc ? (
              <HeroImage src={heroImgSrc} alt={name || setNum} sizes={heroImageSizes()} quality={IMAGE_QUALITY} />
            ) : (
              <div className="grid w-full place-items-center rounded-xl bg-zinc-200 py-24 text-sm text-zinc-500">
                No image available
              </div>
            )}
          </div>
        </div>

        <div>
          <h1 className="m-0 text-2xl font-semibold">{name || "Unknown set"}</h1>

          {bestPrice ? (
            <a href="#shop" className="mt-1 inline-block text-xl font-bold text-amber-600 hover:underline">
              From {formatPrice(bestPrice.price, bestPrice.currency)}
            </a>
          ) : null}

          <p className="mt-2 text-sm text-zinc-500">
            <span className="font-semibold text-zinc-800">{setNum}</span>
            {typeof year === "number" ? (
              <>
                {" "}
                •{" "}
                <Link href={`/years/${year}`} prefetch={false} className="font-semibold hover:underline">
                  {year}
                </Link>
              </>
            ) : null}
          </p>

          {theme ? (
            <p className="mt-1 text-sm text-zinc-500">
              <span className="font-semibold text-zinc-500">Theme:</span>{" "}
              <Link href={`/themes/${themeToSlug(theme)}`} prefetch={false} className="font-semibold hover:underline">
                {theme}
              </Link>
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {typeof parts === "number" ? <span className="text-sm text-zinc-500">{parts.toLocaleString()} pieces</span> : null}
          </div>

          <p className="mt-3 text-sm text-zinc-600">
            ⭐{" "}
            {ratingSummaryLoading ? (
              <span className="inline-block h-4 w-10 animate-pulse rounded bg-zinc-200 align-middle" />
            ) : ratingSummaryError ? (
              <>
                <span className="font-semibold">—</span> <span className="text-red-600">(error loading ratings)</span>
              </>
            ) : ratingCount === 0 ? (
              <span className="text-zinc-500">No ratings yet</span>
            ) : (
              <>
                <span className="font-semibold">{avgRating != null ? avgRating.toFixed(1) : "—"}</span>{" "}
                <span className="text-zinc-500">
                  ({ratingCount} rating{ratingCount === 1 ? "" : "s"})
                </span>
              </>
            )}
          </p>

          <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-[220px]">
                <AddToListMenu
                  token={token || ""}
                  setNum={setNum}
                  initialOwnedSelected={isOwned(setNum)}
                  initialWishlistSelected={isWishlist(setNum)}
                  fullWidth
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-zinc-500">Your rating:</span>

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
                <div className="text-zinc-300">★★★★★</div>
                <div
                  className="pointer-events-none absolute left-0 top-0 overflow-hidden whitespace-nowrap text-amber-500"
                  style={{ width: `${(((hoverRating ?? userRating) || 0) / 5) * 100}%` }}
                >
                  ★★★★★
                </div>
              </div>

              {userRating != null ? <span className="text-sm text-zinc-500">{Number(userRating).toFixed(1)}</span> : null}
              {ratingError ? <span className="text-sm text-red-600">{ratingError}</span> : null}
            </div>

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
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
              >
                {showReviewForm ? "Cancel review" : myReview ? "✏️ Edit your review" : "✍️ Leave a review"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  const url = window.location.href;
                  const title = name || setNum;
                  if (typeof navigator !== "undefined" && navigator.share) {
                    try {
                      await navigator.share({ title, url });
                      gaEvent("share", { method: "native_share", content_type: "set", item_id: setNum });
                    } catch { /* user cancelled */ }
                  } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(url);
                    setShareCopied(true);
                    toast.push("Link copied!", { type: "success" });
                    gaEvent("share", { method: "copy_link", content_type: "set", item_id: setNum });
                    setTimeout(() => setShareCopied(false), 2000);
                  }
                }}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                {shareCopied ? "Copied!" : "Share"}
              </button>

              {/* Deal alert bell */}
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={toggleAlert}
                  disabled={alertLoading}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    hasAlert
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                  }`}
                  title={hasAlert ? "Remove price drop alert" : "Get notified of price drops"}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill={hasAlert ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={hasAlert ? 0 : 2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                    </svg>
                    {alertLoading ? "…" : hasAlert ? "Alerts on" : "Notify me"}
                  </span>
                </button>
              ) : null}
              {!isLoggedIn ? <span className="text-sm text-zinc-500">Log in to rate or review this set.</span> : null}
            </div>

            {ratingError ? <p className="mt-2 text-sm text-red-600">{ratingError}</p> : null}
          </section>
        </div>
      </section>

      {/* SHOP */}
      <section id="shop" className="mt-12 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Offers &amp; availability</h2>
            <p className="mt-1 text-sm text-zinc-500">Compare retailers and find the best price.</p>
          </div>

        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">Affiliate links may be used.</span>
          </div>

          {offersData?.summary?.updated_at ? (
            <div className="mt-2 text-xs text-zinc-500">Last updated: {new Date(offersData.summary.updated_at).toLocaleString()}</div>
          ) : null}

          <div className="mt-3">
            <OffersSection
              setNum={setNum}
              offers={uiOffers}
              placement="set_detail_shop"
              loading={offersLoading}
              error={offersError}
              onRetry={() => {
                const retired =
                  setDetail?.status === "retired" || setDetail?.is_retired === true || setDetail?.retired === true;
                fetchOffers(setNum, retired ? "retired" : "unknown");
              }}
            />
          </div>

          {/* CTA #2 (After offers) */}
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900">
                  {ctaVariant === "A" ? "Get deal alerts for this set" : "Want a price drop notification?"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {ctaVariant === "A"
                    ? "We’ll email you when it goes on sale."
                    : "Track this set and we’ll let you know when there’s a better price."}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  ctaClick({
                    cta_id: "after_offers_alerts",
                    placement: "after_offers",
                    variant: ctaVariant,
                    set_num: setNum,
                  });

                  setShowAlerts(true);

                  window.setTimeout(() => {
                    alertsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 50);
                }}
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {ctaVariant === "A" ? "Enable alerts" : "Notify me"}
              </button>
            </div>

            {showAlerts ? (
              <div ref={alertsRef} className="mt-3 scroll-mt-24">
                <EmailCapture
                  source={`set:${setNum}:after_offers:${ctaVariant}`}
                  onComplete={() => {
                    ctaComplete({
                      cta_id: "after_offers_alerts",
                      placement: "after_offers",
                      variant: ctaVariant,
                      set_num: setNum,
                    });
                  }}
                />
              </div>
            ) : null}
          </div>

          <p className="mt-4 text-xs text-zinc-500">Links may be affiliate links. We may earn a commission.</p>
        </div>
      </section>

      {/* PRICE HISTORY (Coming Soon) */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">Price History</h2>
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-12 text-center">
          <svg className="h-10 w-10 text-zinc-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <div className="text-base font-semibold text-zinc-600">Coming soon</div>
          <p className="mt-1 text-sm text-zinc-500">We&apos;re working on price tracking. Stay tuned.</p>
        </div>
      </section>

      {/* Ad slot between offers/price and reviews */}
      <AdSlot slot="set_detail_mid" format="horizontal" className="mt-10" />

      {/* REVIEWS */}
      <section className="mt-12">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Reviews</h2>
          {visibleReviews.length > 1 ? (
            <select
              value={reviewSort}
              onChange={(e) => setReviewSort(e.target.value as ReviewSortKey)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
            </select>
          ) : null}
        </div>

        {ratingHistogram && ratingCount > 0 ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="mb-2 text-center text-sm font-semibold text-zinc-900">
              {avgRating != null ? avgRating.toFixed(1) : "—"} average from {ratingCount} rating{ratingCount === 1 ? "" : "s"}
            </div>
            <RatingHistogram histogram={ratingHistogram} height={100} barWidth={36} gap={8} />
          </div>
        ) : null}

        {showReviewForm ? (
          <form
            onSubmit={handleReviewSubmit}
            className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4"
          >
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What did you think of this set?"
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20"
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
                  className="rounded-full border border-red-200 bg-transparent px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                >
                  Delete review
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {reviewsLoading ? <div className="mt-3"><ReviewListSkeleton count={2} /></div> : null}
        {reviewsError ? <ErrorState message={reviewsError} /> : null}

        {!reviewsLoading && !reviewsError && visibleReviews.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
            <svg className="h-10 w-10 text-zinc-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <div className="text-base font-semibold text-zinc-600">No reviews yet</div>
            <p className="mt-1 text-sm text-zinc-500">Be the first to share your thoughts on this set</p>
          </div>
        ) : null}

        {!reviewsLoading && !reviewsError && visibleReviews.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {visibleReviews.map((r) => {
              const isMine = isLoggedIn && meUsername && r.user === meUsername;
              const when = formatReviewDate(r.created_at);
              const u = normalizeUsername(r.user);

              return (
                <li
                  key={String(r.id)}
                  className="rounded-2xl border border-zinc-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-zinc-500">
                      {u ? (
                        <Link
                          href={`/users/${encodeURIComponent(u)}`}
                          className="font-semibold text-zinc-800 hover:underline"
                        >
                          {u}
                        </Link>
                      ) : (
                        <span className="font-semibold text-zinc-800">Unknown</span>
                      )}
                      {when ? <span className="ml-2 font-semibold text-zinc-500">• {when}</span> : null}
                    </div>

                    <div className="flex items-center gap-2">
                      {typeof r.rating === "number" ? (
                        <div className="text-sm font-semibold text-amber-600">{r.rating.toFixed(1)} ★</div>
                      ) : null}

                      {isMine ? (
                        <>
                          <button
                            type="button"
                            onClick={startEditMyReview}
                            className="rounded-full border border-zinc-200 bg-transparent px-3 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={deleteMyReview}
                            className="rounded-full border border-red-200 bg-transparent px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {asTrimmedString(r.text) ? <p className="mt-2 text-sm text-zinc-600">{r.text}</p> : null}

                  <div className="mt-3 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleVote(r.id, "up")}
                      disabled={!token}
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        r.user_vote === "up"
                          ? "font-semibold text-amber-600"
                          : "text-zinc-400 hover:text-zinc-600"
                      } disabled:opacity-40`}
                      title="Helpful"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
                      </svg>
                      {r.upvotes > 0 ? r.upvotes : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVote(r.id, "down")}
                      disabled={!token}
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        r.user_vote === "down"
                          ? "font-semibold text-red-500"
                          : "text-zinc-400 hover:text-zinc-600"
                      } disabled:opacity-40`}
                      title="Not helpful"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.048.15.62 1.555.903 3.3.903 5.1a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
                      </svg>
                      {r.downvotes > 0 ? r.downvotes : null}
                    </button>

                    {/* Report button — only for other users' reviews */}
                    {token && r.user !== meUsername ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (reportingReviewId === r.id) {
                            setReportingReviewId(null);
                          } else {
                            setReportingReviewId(r.id);
                            setReportReason("spam");
                            setReportNotes("");
                          }
                        }}
                        className="ml-auto flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                        title="Report this review"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                        </svg>
                      </button>
                    ) : null}
                  </div>

                  {/* Inline report form */}
                  {reportingReviewId === r.id ? (
                    <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-xs font-semibold text-zinc-700 mb-2">Report this review</p>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-xs text-zinc-500 mb-1">Reason</label>
                          <select
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700"
                          >
                            <option value="spam">Spam</option>
                            <option value="offensive">Offensive</option>
                            <option value="inappropriate">Inappropriate</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="flex-[2] min-w-[160px]">
                          <label className="block text-xs text-zinc-500 mb-1">Notes (optional)</label>
                          <input
                            type="text"
                            maxLength={200}
                            value={reportNotes}
                            onChange={(e) => setReportNotes(e.target.value)}
                            placeholder="Any additional details…"
                            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 placeholder:text-zinc-400"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleReportSubmit(r.id)}
                            disabled={reportSubmitting}
                            className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                          >
                            {reportSubmitting ? "Sending…" : "Submit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportingReviewId(null)}
                            className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {/* MORE FROM THIS THEME */}
      {(similarLoading || similarError || similarSets.length > 0) && (
        <section className="mt-12">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">More from {setDetail?.theme}</h2>

            {setDetail?.theme ? (
              <Link
                href={`/themes/${themeToSlug(String(setDetail.theme))}`}
                prefetch={false}
                className="text-sm font-semibold text-amber-600 hover:text-amber-500 transition-colors"
              >
                Browse all &rarr;
              </Link>
            ) : null}
          </div>

          {similarLoading ? <div className="mt-4"><SetGridSkeleton count={4} /></div> : null}
          {similarError ? <ErrorState message={similarError} /> : null}

          {!similarLoading && !similarError && similarSets.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No other sets found for this theme yet.</p>
          ) : null}

          {!similarLoading && !similarError && similarSets.length > 0 ? (
            <div className="relative mt-4">
              <div ref={similarRowRef} className="overflow-x-auto pb-2 scrollbar-thin">
                <ul className="m-0 flex list-none gap-3 p-0">
                  {similarSets.map((s) => (
                    <li key={s.set_num} className="w-[220px] shrink-0">
                      <SetCard set={s} footer={token ? <SetCardActions token={token} setNum={s.set_num} isOwned={isOwned(s.set_num)} isWishlist={isWishlist(s.set_num)} /> : undefined} />
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => scrollSimilar(-1)}
                aria-label="Scroll left"
                className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-zinc-50/90 p-1.5 text-zinc-500 shadow-sm backdrop-blur hover:bg-zinc-100 hover:text-zinc-700 sm:block transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => scrollSimilar(1)}
                aria-label="Scroll right"
                className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-zinc-50/90 p-1.5 text-zinc-500 shadow-sm backdrop-blur hover:bg-zinc-100 hover:text-zinc-700 sm:block transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}