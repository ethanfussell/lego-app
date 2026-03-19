// frontend_next/app/sets/[setNum]/SetDetailClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { asTrimmedString, isRecord } from "@/lib/types";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import AddToListMenu from "@/app/components/AddToListMenu";
import { useCollectionStatus, notifyCollectionChanged } from "@/lib/useCollectionStatus";
import type { Offer as UiOffer } from "@/app/components/OffersSection";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { themeToSlug } from "@/lib/slug";
import { heroImageSizes, IMAGE_QUALITY } from "@/lib/image";
import { useToast } from "@/app/ui-providers/ToastProvider";
import { DetailPageSkeleton } from "@/app/components/Skeletons";
import ErrorState from "@/app/components/ErrorState";
import AdSlot from "@/app/components/AdSlot";

// CTA experiment (CTA #2 after offers)
import { gaEvent } from "@/lib/ga";
import { variantFromKey, variantFromQuery, type Variant } from "@/lib/ab";

// Extracted section components
import ReviewsSection, { type ReviewItem } from "./ReviewsSection";
import SimilarSetsSection from "./SimilarSetsSection";
import ShopSection from "./ShopSection";
import CollectionStats from "./CollectionStats";

function normalizeUsername(raw: unknown): string | null {
  return asTrimmedString(raw);
}

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
  retail_price?: number | null;
  retail_currency?: string | null;
  // Brickset enrichment fields
  subtheme?: string | null;
  minifigs?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  dimensions?: { height?: number | null; width?: number | null; depth?: number | null } | null;
  weight_kg?: number | null;
  launch_date?: string | null;
  exit_date?: string | null;
  retirement_status?: string | null;
  retirement_date?: string | null;
  set_tag?: string | null;
  ip?: string | null;
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

function formatRetirementStatus(
  status: string | null | undefined,
): { label: string; color: string } | null {
  switch (status) {
    case "available":
      return { label: "Available", color: "bg-emerald-100 text-emerald-700" };
    case "retiring_soon":
      return { label: "Retiring Soon", color: "bg-amber-100 text-amber-700" };
    case "retired":
      return { label: "Retired", color: "bg-zinc-200 text-zinc-600" };
    case "coming_soon":
      return { label: "Coming Soon", color: "bg-sky-100 text-sky-700" };
    default:
      return null;
  }
}

function formatSpecDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length === 2) {
    const d = new Date(`${dateStr}-01`);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short" }).format(d);
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(d);
}

function formatDimensions(
  dims: { height?: number | null; width?: number | null; depth?: number | null } | null | undefined,
): string | null {
  if (!dims) return null;
  const vals: string[] = [];
  if (typeof dims.height === "number") vals.push(String(dims.height));
  if (typeof dims.width === "number") vals.push(String(dims.width));
  if (typeof dims.depth === "number") vals.push(String(dims.depth));
  if (vals.length === 0) return null;
  return `${vals.join(" x ")} cm`;
}

function formatAgeRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (typeof min === "number" && typeof max === "number") return `${min}\u2013${max}`;
  if (typeof min === "number") return `${min}+`;
  if (typeof max === "number") return `Up to ${max}`;
  return null;
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
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  }, []);

  const zoomStyle: React.CSSProperties = {
    transformOrigin: origin,
    transform: zoomed ? "scale(2)" : "scale(1)",
    transition: "transform 0.2s ease-out",
  };

  if (failed) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-zoom-in overflow-hidden"
        onMouseEnter={() => setZoomed(true)}
        onMouseLeave={() => setZoomed(false)}
        onMouseMove={handleMouseMove}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain p-6"
          loading="eager"
          decoding="async"
          style={zoomStyle}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-zoom-in overflow-hidden"
      onMouseEnter={() => setZoomed(true)}
      onMouseLeave={() => setZoomed(false)}
      onMouseMove={handleMouseMove}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={quality}
        priority={priority}
        placeholder="empty"
        className="object-contain p-6"
        style={zoomStyle}
        onError={() => setFailed(true)}
      />
    </div>
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

  // CTA variant (A/B) per set, overridable by ?cta=A|B
  const ctaVariant: Variant = useMemo(() => {
    const forced = variantFromQuery(sp.get("cta"));
    return forced ?? variantFromKey(setNum || "set");
  }, [sp, setNum]);

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

  // Reviews state (kept in parent, passed as props to ReviewsSection)
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

  // Social stats disabled (social features deferred)

  const myReview = useMemo(() => {
    if (!isLoggedIn || !meUsername) return null;
    return reviews.find((r) => r.user === meUsername) || null;
  }, [reviews, isLoggedIn, meUsername]);

  const uiOffers: UiOffer[] = useMemo(() => toUiOffers(offersData?.offers ?? []), [offersData?.offers]);

  const bestPrice = useMemo(() => {
    const priced = uiOffers
      .filter((o) => typeof o.price === "number" && Number.isFinite(o.price))
      .sort((a, b) => (a.price as number) - (b.price as number));
    if (priced.length === 0) return null;
    return { price: priced[0].price as number, currency: priced[0].currency };
  }, [uiOffers]);

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

  // Social stats fetch disabled (social features deferred)

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
      router.push("/sign-in");
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
      router.push("/sign-in");
      return;
    }
    setShowReviewForm(true);
    setReviewText(myReview?.text || "");
    setReviewSubmitError(null);
    if (typeof myReview?.rating === "number") setUserRating(myReview.rating);
  }

  async function deleteMyReview() {
    if (!token) {
      router.push("/sign-in");
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
      router.push("/sign-in");
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
      router.push("/sign-in");
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
      router.push("/sign-in");
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

  async function handleReport(reviewId: number, reason: string, notes: string) {
    if (!token) return;
    try {
      await apiFetch("/reports", { method: "POST", token, body: { target_type: "review", target_id: reviewId, reason, notes: notes || null } });
      toast.push("Report submitted", { type: "success" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("409") || msg.includes("already_reported")) {
        toast.push("You've already reported this review", { type: "error" });
      } else if (msg.includes("cannot_report_own")) {
        toast.push("You can't report your own review", { type: "error" });
      } else {
        toast.push(msg || "Failed to submit report", { type: "error" });
      }
    }
  }

  // Deal computation: compare best offer price to MSRP (must be before render guards to keep hooks stable)
  const dealInfo = useMemo(() => {
    if (!setDetail) return null;
    const { retail_price, retail_currency } = setDetail;
    if (!bestPrice || typeof bestPrice.price !== "number") return null;
    if (typeof retail_price !== "number" || retail_price <= 0) return null;
    if (bestPrice.price >= retail_price) return null;

    const savings = Math.round((retail_price - bestPrice.price) * 100) / 100;
    const discountPct = Math.round((1 - bestPrice.price / retail_price) * 100);
    if (discountPct < 1) return null;

    return {
      retailPrice: retail_price,
      salePrice: bestPrice.price,
      currency: bestPrice.currency || retail_currency || "USD",
      savings,
      discountPct,
    };
  }, [bestPrice, setDetail]);

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
            &larr; Back
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
          &larr; Back
        </button>
      </div>
    );
  }

  const { name, year, theme, pieces, num_parts, image_url, retail_price, retail_currency } = setDetail;
  const parts = typeof num_parts === "number" ? num_parts : pieces;
  const heroImgSrc = asTrimmedString(image_url);
  const retirementBadge = formatRetirementStatus(setDetail.retirement_status);
  const ageRange = formatAgeRange(setDetail.age_min, setDetail.age_max);

  // Build spec items array (only items with data)
  type SpecItem = { label: string; value: string };
  const specItems: SpecItem[] = [];
  if (typeof parts === "number") {
    specItems.push({ label: "Pieces", value: parts.toLocaleString() });
  }
  if (typeof setDetail.minifigs === "number" && setDetail.minifigs > 0) {
    specItems.push({ label: "Minifigures", value: String(setDetail.minifigs) });
  }
  if (ageRange) {
    specItems.push({ label: "Age Range", value: ageRange });
  }
  const dimensionsStr = formatDimensions(setDetail.dimensions);
  if (dimensionsStr) {
    specItems.push({ label: "Box Dimensions", value: dimensionsStr });
  }
  if (typeof setDetail.weight_kg === "number") {
    specItems.push({ label: "Weight", value: `${setDetail.weight_kg} kg` });
  }
  if (setDetail.subtheme) {
    specItems.push({ label: "Subtheme", value: setDetail.subtheme });
  }
  if (setDetail.launch_date) {
    specItems.push({ label: "Launch Date", value: formatSpecDate(setDetail.launch_date) || setDetail.launch_date });
  }
  if (setDetail.exit_date) {
    specItems.push({ label: "Exit Date", value: formatSpecDate(setDetail.exit_date) || setDetail.exit_date });
  }
  if (setDetail.retirement_date && setDetail.retirement_status === "retired") {
    specItems.push({ label: "Retired", value: formatSpecDate(setDetail.retirement_date) || setDetail.retirement_date });
  }
  const hasAnySpecs = specItems.length > 0;

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
      <section className="mt-6 grid gap-8 md:grid-cols-[minmax(280px,400px)_1fr] lg:grid-cols-[minmax(320px,480px)_1fr]">
        {/* Image */}
        <div>
          <div className="relative grid h-[480px] place-items-center rounded-2xl border border-zinc-200 bg-white p-6">
            {dealInfo ? (
              <div className="absolute left-3 top-3 z-10 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                SALE &minus;{dealInfo.discountPct}%
              </div>
            ) : null}
            {retirementBadge ? (
              <span className={`absolute right-3 top-3 z-10 rounded-full px-3 py-1 text-xs font-bold ${retirementBadge.color}`}>
                {retirementBadge.label}
              </span>
            ) : null}
            {heroImgSrc ? (
              <HeroImage src={heroImgSrc} alt={name || setNum} sizes={heroImageSizes()} quality={IMAGE_QUALITY} />
            ) : (
              <div className="grid w-full place-items-center rounded-xl bg-zinc-100 py-24 text-sm text-zinc-500">
                No image available
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          {/* Set tag */}
          {setDetail.set_tag ? (
            <span className="mb-2 inline-flex w-fit items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-0.5 text-xs font-semibold text-purple-700">
              {setDetail.set_tag}
            </span>
          ) : null}

          {/* Title */}
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{name || "Unknown set"}</h1>

          {/* Subtitle: set_num | year | theme / subtheme */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
            <span className="font-medium text-zinc-700">{setNum}</span>
            {typeof year === "number" ? (
              <>
                <span aria-hidden="true" className="text-zinc-300">|</span>
                <Link href={`/years/${year}`} prefetch={false} className="hover:underline hover:text-amber-600 transition-colors">
                  {year}
                </Link>
              </>
            ) : null}
            {theme ? (
              <>
                <span aria-hidden="true" className="text-zinc-300">|</span>
                <Link href={`/themes/${themeToSlug(theme)}`} prefetch={false} className="hover:underline hover:text-amber-600 transition-colors">
                  {theme}
                </Link>
              </>
            ) : null}
            {setDetail.subtheme && setDetail.subtheme !== theme ? (
              <>
                <span aria-hidden="true" className="text-zinc-300">/</span>
                <span>{setDetail.subtheme}</span>
              </>
            ) : null}
          </div>

          {/* Price */}
          <div className="mt-4">
            {dealInfo ? (
              <a href="#shop" className="inline-flex flex-wrap items-center gap-2 hover:underline">
                <span className="text-2xl font-bold text-emerald-600">
                  {formatPrice(dealInfo.salePrice, dealInfo.currency)}
                </span>
                <span className="text-base text-zinc-400 line-through">
                  {formatPrice(dealInfo.retailPrice, dealInfo.currency)}
                </span>
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
                  {dealInfo.discountPct}% OFF
                </span>
                <span className="text-sm font-medium text-emerald-700">
                  Save {formatPrice(dealInfo.savings, dealInfo.currency)}
                </span>
              </a>
            ) : bestPrice ? (
              <a href="#shop" className="inline-block text-2xl font-bold text-amber-600 hover:underline">
                From {formatPrice(bestPrice.price, bestPrice.currency)}
              </a>
            ) : typeof retail_price === "number" && retail_price > 0 ? (
              <div className="text-xl font-semibold text-zinc-700">
                MSRP {formatPrice(retail_price, retail_currency || "USD")}
              </div>
            ) : null}
          </div>

          {/* Rating summary */}
          <div className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
            {ratingSummaryLoading ? (
              <span className="inline-block h-4 w-20 animate-pulse rounded bg-zinc-200" />
            ) : ratingSummaryError ? (
              <span className="text-red-600">Error loading ratings</span>
            ) : ratingCount === 0 ? (
              <span className="text-zinc-500">No ratings yet</span>
            ) : (
              <>
                <span className="text-amber-500">&#9733;</span>
                <span className="font-semibold text-zinc-800">{avgRating != null ? avgRating.toFixed(1) : "\u2014"}</span>
                <span className="text-zinc-500">
                  ({ratingCount} rating{ratingCount === 1 ? "" : "s"})
                </span>
              </>
            )}
          </div>

          {/* Quick stats pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {typeof parts === "number" ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700">
                {parts.toLocaleString()} pieces
              </span>
            ) : null}
            {typeof setDetail.minifigs === "number" && setDetail.minifigs > 0 ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700">
                {setDetail.minifigs} minifig{setDetail.minifigs === 1 ? "" : "s"}
              </span>
            ) : null}
            {ageRange ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700">
                Ages {ageRange}
              </span>
            ) : null}
          </div>

          {/* Community collection stats */}
          <CollectionStats setNum={setNum} />

          {/* Action card */}
          <div className="mt-auto pt-5">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
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
                      router.push("/sign-in");
                      return;
                    }
                    const value = computeStarsFromPointer(e.currentTarget, e.clientX);
                    await handleStarClick(value);
                  }}
                >
                  <div className="text-zinc-300">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                  <div
                    className="pointer-events-none absolute left-0 top-0 overflow-hidden whitespace-nowrap text-amber-500"
                    style={{ width: `${(((hoverRating ?? userRating) || 0) / 5) * 100}%` }}
                  >
                    &#9733;&#9733;&#9733;&#9733;&#9733;
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
                      router.push("/sign-in");
                      return;
                    }
                    if (!showReviewForm && myReview) startEditMyReview();
                    else setShowReviewForm((v) => !v);
                  }}
                  className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
                >
                  {showReviewForm ? "Cancel review" : myReview ? "Edit your review" : "Leave a review"}
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

                {!isLoggedIn ? <span className="text-sm text-zinc-500">Log in to rate or review this set.</span> : null}
              </div>

              {/* Review form */}
              {showReviewForm ? (
                <form
                  onSubmit={handleReviewSubmit}
                  className="mt-3"
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
                      {reviewSubmitting ? "Saving\u2026" : myReview ? "Save changes" : "Post review"}
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

              {ratingError ? <p className="mt-2 text-sm text-red-600">{ratingError}</p> : null}
            </section>
          </div>
        </div>
      </section>

      {/* SPECIFICATIONS */}
      {hasAnySpecs ? (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-zinc-900">Specifications</h2>
          <dl className="mt-4 max-w-lg overflow-hidden rounded-2xl border border-zinc-200">
            {specItems.map((item, i) => (
              <div
                key={item.label}
                className={`flex items-baseline justify-between gap-4 bg-white px-5 py-3.5${
                  i < specItems.length - 1 ? " border-b border-zinc-100" : ""
                }`}
              >
                <dt className="shrink-0 text-sm text-zinc-500">{item.label}</dt>
                <dd className="text-right text-sm font-medium text-zinc-900">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}


      {/* SHOP */}
      <ShopSection
        setNum={setNum}
        retailPrice={retail_price}
        retailCurrency={retail_currency}
        dealInfo={dealInfo}
        uiOffers={uiOffers}
        offersLoading={offersLoading}
        offersError={offersError}
        offersUpdatedAt={offersData?.summary?.updated_at ?? null}
        ctaVariant={ctaVariant}
        onRetryOffers={() => {
          const retired =
            setDetail?.status === "retired" || setDetail?.is_retired === true || setDetail?.retired === true;
          fetchOffers(setNum, retired ? "retired" : "unknown");
        }}
        retirementBadge={retirementBadge}
      />

      {/* Ad slot between offers/price and reviews */}
      <AdSlot slot="set_detail_mid" format="horizontal" className="mt-10" />

      {/* REVIEWS */}
      <ReviewsSection
        reviews={reviews}
        reviewsLoading={reviewsLoading}
        reviewsError={reviewsError}
        avgRating={avgRating}
        ratingCount={ratingCount}
        isLoggedIn={isLoggedIn}
        meUsername={meUsername}
        token={token}
        onVote={handleVote}
        onReport={handleReport}
        onStartEdit={startEditMyReview}
        onDelete={deleteMyReview}
      />

      {/* MORE FROM THIS THEME */}
      {theme ? (
        <SimilarSetsSection
          theme={theme}
          setNum={setNum}
          token={token}
        />
      ) : null}
    </div>
  );
}
