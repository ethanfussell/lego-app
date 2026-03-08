// frontend_next/app/components/SetCard.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { notifyCollectionChanged } from "@/lib/useCollectionStatus";
import { formatPrice } from "@/lib/format";
import { safeImageSrc } from "@/lib/image";
export type { SetLite } from "@/lib/types";
import type { SetLite } from "@/lib/types";

function CardImage({
  src,
  alt,
  sizes,
  quality = 70,
}: {
  src: string;
  alt: string;
  sizes: string;
  quality?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain p-2"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className="object-contain p-2"
      quality={quality}
      loading="lazy"
      placeholder="empty"
      onError={() => setFailed(true)}
    />
  );
}

type Props = {
  set: SetLite;
  variant?: "default" | "owned" | "wishlist" | "feed";
  footer?: React.ReactNode;
  token?: string; // only needed for owned rating submit
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
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

/**
 * Declared OUTSIDE render to satisfy react-hooks/static-components
 */
function RatingStar({ fillPct }: { fillPct: 0 | 50 | 100 }) {
  return (
    <span className="relative inline-block h-4 w-4">
      <StarIcon className="absolute inset-0 h-4 w-4 text-zinc-300" />
      {fillPct !== 0 ? (
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
          <StarIcon className="h-4 w-4 text-amber-500" />
        </span>
      ) : null}
    </span>
  );
}

function Stars({ value, className = "" }: { value: number; className?: string }) {
  const v = clamp(value, 0, 5);
  const full = Math.floor(v);
  const half = v - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`Rating ${v} out of 5`}>
      {Array.from({ length: full }).map((_, i) => (
        <RatingStar key={`f${i}`} fillPct={100} />
      ))}
      {half ? <RatingStar key="h" fillPct={50} /> : null}
      {Array.from({ length: empty }).map((_, i) => (
        <RatingStar key={`e${i}`} fillPct={0} />
      ))}
    </span>
  );
}

function StarPicker({ disabled, onPick }: { disabled?: boolean; onPick: (n: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onPick(n)}
          className="rounded p-0.5 disabled:opacity-60 hover:scale-110 transition-transform"
          aria-label={`Rate ${n} stars`}
          title={`Rate ${n}`}
        >
          <StarIcon className="h-5 w-5 text-amber-500" />
        </button>
      ))}
    </div>
  );
}

function TitleTwoLines({ title }: { title: string }) {
  return (
    <div
      className="h-[2.5rem] overflow-hidden text-sm font-semibold leading-5 text-zinc-900"
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
      }}
      title={title}
    >
      {title}
    </div>
  );
}

function imageSizesForVariant(variant: Props["variant"]) {
  if (variant === "feed") return "(max-width: 640px) 92vw, (max-width: 1024px) 48vw, 420px";
  return "(max-width: 640px) 92vw, (max-width: 1024px) 48vw, 320px";
}

/** Skeleton placeholder for loading states */
export function SetCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white animate-pulse">
      <div className="aspect-square w-full bg-zinc-200/50 rounded-t-2xl" />
      <div className="px-4 pb-4 pt-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-zinc-200" />
        <div className="h-3 w-1/2 rounded bg-zinc-100" />
        <div className="h-3 w-1/3 rounded bg-zinc-100" />
      </div>
    </div>
  );
}

export default function SetCard({ set, variant = "default", footer, token }: Props) {
  const title = set.name || set.set_num;
  const year = set.year ? String(set.year) : "\u2014";
  const pieces = pickPieces(set);

  const ratingAvg = pickRatingAvg(set);
  const ratingCount = pickRatingCount(set);

  const initialUser =
    typeof set.user_rating === "number" && Number.isFinite(set.user_rating) ? clamp(set.user_rating, 0, 5) : null;

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

  const showPrice = variant === "wishlist" || variant === "feed" || variant === "default";
  const isOwned = variant === "owned";

  const globalRatingCompact = ratingAvg != null ? { text: ratingAvg.toFixed(1), count: ratingCount } : null;

  async function submitRating(n: number) {
    if (!token) {
      setRateErr("Login required");
      return;
    }

    setRateErr(null);
    setSavingRate(true);

    try {
      await apiFetch(`/ratings/${encodeURIComponent(set.set_num)}`, {
        token,
        method: "PUT",
        body: { rating: n },
      });

      setUserRating(n);
      setShowRate(false);
      notifyCollectionChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setRateErr(msg);
    } finally {
      setSavingRate(false);
    }
  }

  const imgSrc = safeImageSrc(set.image_url);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md">
      <Link href={`/sets/${encodeURIComponent(set.set_num)}`} className="block flex-1">
        {/* Image */}
        <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-white">
          {imgSrc ? (
            <div className="relative h-full w-full">
              <CardImage src={imgSrc} alt={title} sizes={imageSizesForVariant(variant)} quality={70} />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-zinc-600">No image</div>
          )}
          {set.retirement_status === "retiring_soon" && (
            <span className="absolute top-2 left-2 inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              Retiring Soon
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-3 pb-3 pt-2.5">
          <TitleTwoLines title={title} />

          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5 truncate">
              <span className="truncate">{set.set_num}</span>
              <span aria-hidden="true">&middot;</span>
              <span className="shrink-0">{year}</span>
            </div>

            {globalRatingCompact ? (
              <div className="flex items-center gap-0.5 whitespace-nowrap">
                <StarIcon className="h-3 w-3 text-amber-500" />
                <span className="font-semibold text-amber-600">{globalRatingCompact.text}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">
              {pieces != null ? `${pieces.toLocaleString()} pcs` : "\u2014"}
            </span>

            {showPrice ? (
              typeof set.set_tag === "string" && set.set_tag.trim() ? (
                <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                  {set.set_tag}
                </span>
              ) : (
                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                  {typeof price.sale === "number" &&
                  typeof price.original === "number" &&
                  Number.isFinite(price.sale) &&
                  Number.isFinite(price.original) &&
                  price.sale < price.original ? (
                    <>
                      <span className="text-sm font-bold text-zinc-900">{formatPrice(price.sale)}</span>
                      <span className="text-[10px] text-zinc-400 line-through">{formatPrice(price.original)}</span>
                    </>
                  ) : typeof price.original === "number" && Number.isFinite(price.original) ? (
                    <span className="text-sm font-bold text-zinc-900">{formatPrice(price.original)}</span>
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        </div>
      </Link>

      {isOwned ? (
        <div className="border-t border-zinc-200 px-4 py-3">
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
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Add a rating
              </button>
            )}

            {rateErr ? <div className="text-xs text-red-400">{rateErr}</div> : null}
          </div>
        </div>
      ) : footer ? (
        <div className="overflow-visible border-t border-zinc-200 px-4 py-3">{footer}</div>
      ) : null}
    </div>
  );
}
