// frontend_next/app/components/OffersSection.tsx
"use client";

import React, { useMemo } from "react";
import { outboundClick } from "@/lib/ga";
import { buildAffiliateUrl } from "@/lib/affiliate";
import { trackAffiliateClick } from "@/lib/events";
import { formatPrice } from "@/lib/format";

export type Offer = {
  url: string;
  store?: string;
  price?: number;
  currency?: string;
  in_stock?: boolean | null;
  updated_at?: string | null;
};

type NormalizedOffer = {
  href: string;
  storeLabel: string;
  price?: number;
  currency?: string;
  inStock: boolean | null;
  updatedAt?: string | null;
  rank: number;
};

export type StockSummary = "in" | "out" | "unknown";

function cleanText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function cleanLabel(v: unknown, fallback: string): string {
  const s = cleanText(v);
  return s || fallback;
}

function cleanCurrency(v: unknown): string | undefined {
  const s = cleanText(v).toUpperCase();
  if (!s) return undefined;
  if (s.length < 3 || s.length > 4) return undefined;
  return s;
}

function cleanPrice(v: unknown): number | undefined {
  if (typeof v !== "number") return undefined;
  if (!Number.isFinite(v)) return undefined;
  return v;
}

function safeUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const u = new URL(s, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function formatUpdatedAt(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

export function summarizeStock(offers: NormalizedOffer[]): StockSummary {
  if (offers.length === 0) return "unknown";
  if (offers.some((o) => o.inStock === true)) return "in";
  if (offers.some((o) => o.inStock === null)) return "unknown";
  if (offers.some((o) => o.inStock === false)) return "out";
  return "unknown";
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="text-sm font-semibold text-zinc-900">Loading offers…</div>
      <div className="mt-3 space-y-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-100 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="h-4 w-32 rounded-full bg-zinc-200" />
              <div className="mt-2 h-3 w-24 rounded-full bg-zinc-200" />
            </div>
            <div className="h-9 w-28 rounded-full bg-zinc-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <div className="font-semibold">Couldn’t load offers.</div>
      <div className="mt-1 break-words opacity-90">{error}</div>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

function stockRank(v: boolean | null) {
  // true (in) -> null (unknown) -> false (out)
  return v === true ? 0 : v === null ? 1 : 2;
}

/** Aftermarket stores excluded from "Best price" badge and deal calculations. */
const AFTERMARKET_STORES = new Set(["BrickLink"]);

function pickBestIndex(sorted: NormalizedOffer[]): number | null {
  // Best = cheapest among retail offers that have a numeric price
  // Excludes aftermarket sellers (BrickLink) since prices aren't directly comparable
  const priced = sorted
    .map((o, idx) => ({ idx, price: typeof o.price === "number" ? o.price : null, store: o.storeLabel }))
    .filter((x): x is { idx: number; price: number; store: string } =>
      typeof x.price === "number" && !AFTERMARKET_STORES.has(x.store)
    );

  if (priced.length === 0) return null;

  priced.sort((a, b) => a.price - b.price);
  return priced[0].idx;
}

function currentPagePath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "in" | "out" | "unknown" | "best" | "marketplace";
}) {
  const cls =
    tone === "in"
      ? "bg-emerald-500/10 text-emerald-700"
      : tone === "out"
      ? "bg-zinc-500/10 text-zinc-700"
      : tone === "best"
      ? "bg-indigo-500/10 text-indigo-700"
      : tone === "marketplace"
      ? "bg-amber-500/10 text-amber-700"
      : "bg-zinc-500/10 text-zinc-700";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      {children}
    </span>
  );
}

export default function OffersSection({
  setNum,
  offers,
  placement = "set_detail_shop",
  emptyMessage = "No offers yet. We’ll show retailers and pricing here when available.",
  loading = false,
  error = null,
  onRetry,
}: {
  setNum: string;
  offers: Offer[];
  placement?: string;
  emptyMessage?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const raw = Array.isArray(offers) ? offers : [];

  const normalized: NormalizedOffer[] = raw
    .map((o, i): NormalizedOffer | null => {
      const href = safeUrl(o?.url);
      if (!href) return null;

      const storeLabel = cleanLabel(o?.store, "Store");
      const price = cleanPrice(o?.price);
      const currency = cleanCurrency(o?.currency);

      const inStock: boolean | null =
        o?.in_stock === true ? true : o?.in_stock === false ? false : null;

      const updatedAt =
        typeof o?.updated_at === "string" && o.updated_at.trim()
          ? o.updated_at.trim()
          : null;

      return { href, storeLabel, price, currency, inStock, updatedAt, rank: i + 1 };
    })
    .filter((x): x is NormalizedOffer => x !== null)
    .filter((x) => typeof x.price === "number");

  const sorted = useMemo(() => {
    return normalized.slice().sort((a, b) => {
      const sa = stockRank(a.inStock);
      const sb = stockRank(b.inStock);
      if (sa !== sb) return sa - sb;

      const pa = typeof a.price === "number" ? a.price : Number.POSITIVE_INFINITY;
      const pb = typeof b.price === "number" ? b.price : Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa - pb;

      return a.rank - b.rank;
    });
  }, [normalized]);

  const anyAffiliateLinks = useMemo(() => {
    for (const o of sorted) {
      const aff = buildAffiliateUrl(
        { url: o.href, store: o.storeLabel, currency: o.currency, price: o.price },
        { placement, setNum, offerRank: o.rank }
      );
      if (aff) return true;
    }
    return false;
  }, [sorted, placement, setNum]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  const bestIdx = pickBestIndex(sorted);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {sorted.map((o, idx) => {
          const isBest = bestIdx != null && idx === bestIdx;

          const affiliateHref = buildAffiliateUrl(
            { url: o.href, store: o.storeLabel, currency: o.currency, price: o.price },
            { placement, setNum, offerRank: o.rank }
          );

          // Always show the row: if affiliate is blocked, fall back to safe raw URL.
          const finalHref = affiliateHref || o.href;
          const isAffiliate = Boolean(affiliateHref);

          const updatedLabel = formatUpdatedAt(o.updatedAt);
          const hasPrice = typeof o.price === "number";
          const priceLabel = hasPrice ? formatPrice(o.price, o.currency) ?? "Price unavailable" : null;

          const isAftermarket = AFTERMARKET_STORES.has(o.storeLabel);
          const stockTone = o.inStock === true ? "in" : o.inStock === false ? "out" : "unknown";
          const stockText = o.inStock === true ? "In stock" : o.inStock === false ? "Out of stock" : null;

          return (
            <li
              key={`${o.href}-${o.rank}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/[.08] bg-white p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-zinc-900">
                    {o.storeLabel}
                  </div>

                  {isAftermarket ? (
                    <Badge tone="marketplace">Marketplace</Badge>
                  ) : stockText ? (
                    <Badge tone={stockTone}>{stockText}</Badge>
                  ) : null}

                  {isBest ? <Badge tone="best">Best price</Badge> : null}
                </div>

                <div className="mt-1 text-xs text-zinc-500">
                  {priceLabel ? <div>{priceLabel}</div> : <div className="text-zinc-400">Check retailer for price</div>}

                  {updatedLabel ? (
                    <div className="mt-0.5 text-[11px] text-zinc-400">Last updated: {updatedLabel}</div>
                  ) : null}
                </div>
              </div>

              <a
                href={finalHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  // ✅ Persist conversion click (best-effort, non-blocking)
                  trackAffiliateClick({
                    set_num: String(setNum || "").trim(),
                    store: String(o.storeLabel || "Store").trim(),
                    price: typeof o.price === "number" ? o.price : null,
                    currency: o.currency ?? null,
                    offer_rank: o.rank,
                    page_path: currentPagePath(),
                  });

                  // ✅ Keep existing analytics
                  outboundClick({
                    url: finalHref,
                    label: o.storeLabel || "offer",
                    placement,
                    set_num: setNum,
                    offer_rank: o.rank,
                    price: o.price,
                    currency: o.currency,
                    conversion: isAffiliate,
                  });
                }}
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
              >
                {hasPrice ? "View offer" : `Search ${o.storeLabel}`} →
              </a>
            </li>
          );
        })}
      </ul>

      {anyAffiliateLinks ? (
        <div className="text-[11px] text-zinc-500">
          Some links may be affiliate links. If you buy through them, we may earn a commission at no extra cost to you.
        </div>
      ) : null}

      {sorted.some((o) => AFTERMARKET_STORES.has(o.storeLabel)) ? (
        <div className="text-[11px] text-zinc-500">
          Marketplace prices are from third-party sellers and may vary. Verify condition, seller rating, and return policy before purchasing.
        </div>
      ) : null}
    </div>
  );
}