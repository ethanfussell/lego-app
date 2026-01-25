// frontend_next/app/components/SetCard.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number | null;
  num_parts?: number | null;
  theme?: string;
  image_url?: string | null;

  // global ratings
  rating_avg?: number | null;
  average_rating?: number | null;
  rating_count?: number | null;

  // user rating
  user_rating?: number | null;

  // pricing
  price_from?: number | null;
  price?: number | null;
  original_price?: number | null;
  sale_price?: number | null;
  sale_price_from?: number | null;
};

type Props = {
  set: SetLite;
  variant?: "default" | "owned" | "wishlist" | "feed";
  footer?: React.ReactNode;

  // only needed if you want to submit user ratings from the card (owned)
  token?: string;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function formatPrice(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return `$${n.toFixed(2)}`;
}

function pickRatingAvg(s: SetLite) {
  const v =
    typeof s.rating_avg === "number"
      ? s.rating_avg
      : typeof s.average_rating === "number"
      ? s.average_rating
      : null;
  return typeof v === "number" && Number.isFinite(v) ? clamp(v, 0, 5) : null;
}

function pickRatingCount(s: SetLite) {
  const v = s.rating_count;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;
}

function pickPieces(s: SetLite) {
  const v =
    typeof s.pieces === "number"
      ? s.pieces
      : typeof s.num_parts === "number"
      ? s.num_parts
      : null;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;
}

function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 17.27l-5.18 3.04 1.4-5.96-4.62-4 6.08-.52L12 4l2.32 5.83 6.08.52-4.62 4 1.4 5.96z" />
    </svg>
  );
}

function Stars({ value, className = "" }: { value: number; className?: string }) {
  const v = clamp(value, 0, 5);
  const full = Math.floor(v);
  const half = v - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;

  const Star = ({ fillPct }: { fillPct: 0 | 50 | 100 }) => (
    <span className="relative inline-block h-4 w-4">
      <StarIcon className="absolute inset-0 h-4 w-4 text-zinc-300 dark:text-zinc-700" />
      {fillPct !== 0 ? (
        <span className="absolute inset-0 overflow-hidden" style={{ width: fillPct === 100 ? "100%" : "50%" }}>
          <StarIcon className="h-4 w-4 text-zinc-900 dark:text-zinc-50" />
        </span>
      ) : null}
    </span>
  );

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`Rating ${v} out of 5`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} fillPct={100} />
      ))}
      {half ? <Star key="h" fillPct={50} /> : null}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} fillPct={0} />
      ))}
    </span>
  );
}

function StarPicker({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onPick(n)}
          className="rounded p-0.5 disabled:opacity-60"
          aria-label={`Rate ${n} stars`}
          title={`Rate ${n}`}
        >
          <StarIcon className="h-5 w-5 text-zinc-900 dark:text-zinc-50" />
        </button>
      ))}
    </div>
  );
}

export default function SetCard({ set, variant = "default", footer, token }: Props) {
  const title = set.name || set.set_num;
  const year = set.year ? String(set.year) : "—";
  const pieces = pickPieces(set);

  const ratingAvg = pickRatingAvg(set);
  const ratingCount = pickRatingCount(set);

  const initialUser =
    typeof set.user_rating === "number" && Number.isFinite(set.user_rating)
      ? clamp(set.user_rating, 0, 5)
      : null;

  const [userRating, setUserRating] = useState<number | null>(initialUser);
  const [showRate, setShowRate] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [rateErr, setRateErr] = useState<string | null>(null);

  const price = useMemo(() => {
    const sale =
      typeof set.sale_price === "number"
        ? set.sale_price
        : typeof set.sale_price_from === "number"
        ? set.sale_price_from
        : null;

    const original =
      typeof set.original_price === "number"
        ? set.original_price
        : typeof set.price === "number"
        ? set.price
        : typeof set.price_from === "number"
        ? set.price_from
        : null;

    return { original, sale };
  }, [set]);

  // Per your plan:
  // - owned: only user rating footer (or add rating)
  // - wishlist: show price area (and parent can inject shop button via footer)
  // - feed/default: show price area (sale/new/retiring soon)
  const showPrice = variant === "wishlist" || variant === "feed" || variant === "default";
  const isOwned = variant === "owned";

  const globalRatingCompact =
    ratingAvg != null
      ? {
          text: ratingAvg.toFixed(1),
          count: ratingCount,
        }
      : null;

  async function submitRating(n: number) {
    if (!token) {
      setRateErr("Login required");
      return;
    }

    setRateErr(null);
    setSavingRate(true);

    try {
      // ⚠️ If your backend rating endpoint differs, change ONLY this call.
      // Common options:
      //  - PUT  /ratings/{set_num}   body { rating }
      //  - POST /ratings             body { set_num, rating }
      await apiFetch(`/ratings/${encodeURIComponent(set.set_num)}`, {
        token,
        method: "PUT",
        body: { rating: n },
      });

      setUserRating(n);
      setShowRate(false);
    } catch (e: any) {
      setRateErr(e?.message || String(e));
    } finally {
      setSavingRate(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-white shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
      <Link href={`/sets/${encodeURIComponent(set.set_num)}`} className="block">
        <div className="aspect-[4/3] w-full bg-zinc-50 dark:bg-white/5">
          {set.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={set.image_url} alt={title} className="h-full w-full object-contain p-4" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">No image</div>
          )}
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>

          {/* line 1: set_num • year */}
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <span className="truncate">{set.set_num}</span>
            <span aria-hidden="true">•</span>
            <span className="shrink-0">{year}</span>
          </div>

          {/* line 2: pieces • global rating compact */}
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="truncate">{pieces != null ? `${pieces.toLocaleString()} pcs` : "—"}</div>

            {globalRatingCompact ? (
              <div className="flex items-center gap-1 whitespace-nowrap">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {globalRatingCompact.text}
                </span>
                <StarIcon className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                {typeof globalRatingCompact.count === "number" ? (
                  <span className="text-zinc-500">({globalRatingCompact.count})</span>
                ) : null}
              </div>
            ) : (
              <span className="text-zinc-500"> </span>
            )}
          </div>

          {/* price area */}
          {showPrice ? (
            <div className="mt-2 flex items-baseline gap-2 text-sm">
              {typeof price.sale === "number" &&
              typeof price.original === "number" &&
              Number.isFinite(price.sale) &&
              Number.isFinite(price.original) &&
              price.sale < price.original ? (
                <>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatPrice(price.sale)}</span>
                  <span className="text-xs text-zinc-500 line-through">{formatPrice(price.original)}</span>
                </>
              ) : typeof price.original === "number" && Number.isFinite(price.original) ? (
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatPrice(price.original)}</span>
              ) : (
                <span className="text-xs text-zinc-500"> </span>
              )}
            </div>
          ) : null}
        </div>
      </Link>

      {/* footer */}
      {isOwned ? (
        <div className="border-t border-black/[.06] px-4 py-3 dark:border-white/[.10]">
          <div className="flex flex-col items-center gap-2">
            {userRating != null ? (
              <Stars value={userRating} className="justify-center" />
            ) : showRate ? (
              <StarPicker disabled={savingRate} onPick={submitRating} />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRateErr(null);
                  setShowRate(true);
                }}
                className="rounded-full border border-black/[.10] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
              >
                Add a rating
              </button>
            )}

            {rateErr ? <div className="text-xs text-red-600">{rateErr}</div> : null}
          </div>
        </div>
      ) : footer ? (
        <div className="border-t border-black/[.06] px-4 py-3 dark:border-white/[.10]">{footer}</div>
      ) : null}
    </div>
  );
}