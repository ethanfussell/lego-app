// frontend_next/app/components/AffiliateBanner.tsx
"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { buildAffiliateUrl } from "@/lib/affiliate";
import { trackAffiliateClick } from "@/lib/events";
import { outboundClick } from "@/lib/ga";
import { formatPrice } from "@/lib/format";

export type AffiliateDeal = {
  set_num: string;
  name: string;
  image_url: string | null;
  headline: string;
  price: number;
  original_price?: number;
  currency?: string;
  /** Store name + url for direct affiliate link; omit to link to set detail page. */
  store?: string;
  url?: string;
};

type Props = {
  placement: string;
  deal: AffiliateDeal | null;
  className?: string;
};

function currentPagePath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

/**
 * Branded affiliate deal banner.
 * Visually distinct from AdSense — shows a specific LEGO set deal.
 *
 * Two modes:
 * - With `store` + `url`: direct affiliate link to retailer (tracked via affiliate system)
 * - Without: links to the set detail page where full offers are shown
 */
export default function AffiliateBanner({ placement, deal, className = "" }: Props) {
  if (!deal) return null;

  const hasExternalLink = Boolean(deal.url && deal.store);

  // Build affiliate URL if we have a store link
  const affiliateHref = hasExternalLink
    ? buildAffiliateUrl(
        { url: deal.url!, store: deal.store!, currency: deal.currency, price: deal.price },
        { placement, setNum: deal.set_num, offerRank: 1 },
      )
    : "";

  const isAffiliate = Boolean(affiliateHref);

  const priceLabel = formatPrice(deal.price, deal.currency);
  const originalLabel = deal.original_price
    ? formatPrice(deal.original_price, deal.currency)
    : null;

  function handleExternalClick() {
    if (!hasExternalLink) return;
    trackAffiliateClick({
      set_num: deal!.set_num,
      store: deal!.store || "Store",
      price: deal!.price,
      currency: deal!.currency ?? null,
      page_path: currentPagePath(),
    });

    outboundClick({
      url: affiliateHref || deal!.url!,
      label: deal!.store || "deal",
      placement,
      set_num: deal!.set_num,
      price: deal!.price,
      currency: deal!.currency,
      conversion: isAffiliate,
    });
  }

  const ctaContent = (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors">
      {hasExternalLink ? "View deal →" : "See offers →"}
    </span>
  );

  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-4 ${className}`}>
      <div className="mb-2 text-xs font-semibold text-amber-600">Recommended Deal</div>

      <div className="flex gap-4">
        {/* Set image */}
        {deal.image_url ? (
          <div className="hidden shrink-0 sm:block">
            <div className="relative h-[120px] w-[160px] overflow-hidden rounded-lg bg-zinc-50">
              <Image
                src={deal.image_url}
                alt={deal.name}
                fill
                sizes="160px"
                className="object-contain p-1"
              />
            </div>
          </div>
        ) : null}

        {/* Deal info */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-zinc-900 line-clamp-2">{deal.name}</div>
            <div className="mt-1 text-sm text-zinc-600">{deal.headline}</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {priceLabel ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-zinc-900">{priceLabel}</span>
                {originalLabel ? (
                  <span className="text-sm text-zinc-400 line-through">{originalLabel}</span>
                ) : null}
              </div>
            ) : null}

            {hasExternalLink ? (
              <a
                href={affiliateHref || deal.url!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalClick}
              >
                {ctaContent}
              </a>
            ) : (
              <Link href={`/sets/${deal.set_num}#shop`}>
                {ctaContent}
              </Link>
            )}
          </div>
        </div>
      </div>

      {isAffiliate ? (
        <div className="mt-3 text-[11px] text-zinc-500">
          Affiliate link — we may earn a commission at no extra cost to you.
        </div>
      ) : null}
    </div>
  );
}
