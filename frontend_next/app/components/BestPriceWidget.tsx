// frontend_next/app/components/BestPriceWidget.tsx
"use client";

import React, { useMemo } from "react";
import { buildAffiliateUrl } from "@/lib/affiliate";
import { outboundClick } from "@/lib/ga";
import { formatPrice } from "@/lib/format";

export type BestPriceOffer = {
  url: string;
  store?: string;
  currency?: string;
  price?: number;
  in_stock?: boolean | null;
  updated_at?: string | null;
};

function stockLabel(v: boolean | null | undefined): { text: string; cls: string } {
  if (v === true) return { text: "In stock", cls: "bg-emerald-50 text-emerald-700" };
  if (v === false) return { text: "Out of stock", cls: "bg-zinc-100 text-zinc-600" };
  return { text: "Unknown", cls: "bg-zinc-100 text-zinc-600" };
}

function safeDateLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

function pickBestOffer(offers: BestPriceOffer[]): BestPriceOffer | null {
  const stockRank = (v: boolean | null | undefined) => (v === true ? 0 : v == null ? 1 : 2);

  const sorted = [...offers].sort((a, b) => {
    const sa = stockRank(a.in_stock);
    const sb = stockRank(b.in_stock);
    if (sa !== sb) return sa - sb;

    const pa = typeof a.price === "number" ? a.price : Number.POSITIVE_INFINITY;
    const pb = typeof b.price === "number" ? b.price : Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;

    return 0;
  });

  const best = sorted[0] ?? null;
  if (!best) return null;

  // If we have literally no usable price AND no url, treat as empty.
  if (!best.url) return null;

  return best;
}

export default function BestPriceWidget({
  setNum,
  offers,
  summaryUpdatedAt,
  placement = "set_detail_best_price",
}: {
  setNum: string;
  offers: BestPriceOffer[];
  summaryUpdatedAt?: string | null;
  placement?: string;
}) {
  const best = useMemo(() => pickBestOffer(offers || []), [offers]);
  const count = Array.isArray(offers) ? offers.length : 0;

  const bestUpdated = best?.updated_at ?? null;
  const updatedLabel = safeDateLabel(bestUpdated || summaryUpdatedAt);

  if (!best || count === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3">
        <div className="text-sm font-semibold text-zinc-900">Best price</div>
        <div className="mt-1 text-xs text-zinc-500">No offers yet.</div>
      </div>
    );
  }

  const store = String(best.store ?? "").trim() || "Store";
  const priceText = formatPrice(best.price, best.currency) ?? "Price unavailable";
  const stock = stockLabel(best.in_stock);

  const affiliateHref = buildAffiliateUrl(
    { url: best.url, store, currency: best.currency, price: best.price },
    { placement, setNum, offerRank: 1 }
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">Best price</div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-zinc-900">{priceText}</span>

            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${stock.cls}`}>{stock.text}</span>

            <span className="text-xs font-semibold text-zinc-600">{store}</span>
          </div>

          <div className="mt-1 text-xs text-zinc-500">
            {updatedLabel ? `Updated: ${updatedLabel}` : null}
            {count > 1 ? (updatedLabel ? ` • ${count - 1} more offer${count - 1 === 1 ? "" : "s"}` : `${count - 1} more offer${count - 1 === 1 ? "" : "s"}`) : null}
          </div>
        </div>

        {affiliateHref ? (
          <a
            href={affiliateHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              outboundClick({
                url: affiliateHref,
                label: "Best price",
                placement,
                set_num: setNum,
                offer_rank: 1,
                price: best.price,
                currency: best.currency,
              });
            }}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
          >
            View best →
          </a>
        ) : null}
      </div>
    </div>
  );
}