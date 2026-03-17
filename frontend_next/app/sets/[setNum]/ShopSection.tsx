// frontend_next/app/sets/[setNum]/ShopSection.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import OffersSection, { type Offer as UiOffer } from "@/app/components/OffersSection";
import EmailCapture from "@/app/components/EmailCapture";
import { ctaClick, ctaComplete, ctaImpression } from "@/lib/events";
import type { Variant } from "@/lib/ab";

function formatPrice(price?: number, currency?: string): string | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

type DealInfo = {
  retailPrice: number;
  salePrice: number;
  currency: string;
  savings: number;
  discountPct: number;
};

type RetirementBadge = {
  label: string;
  color: string;
};

type Props = {
  setNum: string;
  retailPrice?: number | null;
  retailCurrency?: string | null;
  dealInfo: DealInfo | null;
  uiOffers: UiOffer[];
  offersLoading: boolean;
  offersError: string | null;
  offersUpdatedAt: string | null;
  ctaVariant: Variant;
  onRetryOffers: () => void;
  retirementBadge: RetirementBadge | null;
};

export default function ShopSection({
  setNum,
  retailPrice,
  retailCurrency,
  dealInfo,
  uiOffers,
  offersLoading,
  offersError,
  offersUpdatedAt,
  ctaVariant,
  onRetryOffers,
  retirementBadge,
}: Props) {
  const [showAlerts, setShowAlerts] = useState(false);
  const alertsRef = useRef<HTMLDivElement | null>(null);
  const ctaSeenRef = useRef<Record<string, true>>({});

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

  const bestPrice = React.useMemo(() => {
    const priced = uiOffers
      .filter((o) => typeof o.price === "number" && Number.isFinite(o.price))
      .sort((a, b) => (a.price as number) - (b.price as number));
    if (priced.length === 0) return null;
    return { price: priced[0].price as number, currency: priced[0].currency };
  }, [uiOffers]);

  return (
    <>
      <section id="shop" className="mt-12 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Offers &amp; availability</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {retirementBadge?.label === "Retired"
                ? "This set is retired. Check secondary market for availability."
                : "Compare retailers and find the best price."}
            </p>
          </div>
          {retirementBadge ? (
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${retirementBadge.color}`}>
              {retirementBadge.label}
            </span>
          ) : null}
        </div>

        {/* Deal banner */}
        {dealInfo ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white">
                  {dealInfo.discountPct}% OFF
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-emerald-700">
                      {formatPrice(dealInfo.salePrice, dealInfo.currency)}
                    </span>
                    <span className="text-sm text-zinc-500 line-through">
                      MSRP {formatPrice(dealInfo.retailPrice, dealInfo.currency)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-emerald-700">
                    You save {formatPrice(dealInfo.savings, dealInfo.currency)} on this set
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : typeof retailPrice === "number" && retailPrice > 0 && bestPrice ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span className="font-medium">MSRP {formatPrice(retailPrice, retailCurrency || "USD")}</span>
              <span>&middot;</span>
              <span>Best price matches retail</span>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">Affiliate links may be used.</span>
          </div>

          {offersUpdatedAt ? (
            <div className="mt-2 text-xs text-zinc-500">Last updated: {new Date(offersUpdatedAt).toLocaleString()}</div>
          ) : null}

          <div className="mt-3">
            <OffersSection
              setNum={setNum}
              offers={uiOffers}
              placement="set_detail_shop"
              loading={offersLoading}
              error={offersError}
              onRetry={onRetryOffers}
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
                    ? "We'll email you when it goes on sale."
                    : "Track this set and we'll let you know when there's a better price."}
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
    </>
  );
}
