// frontend_next/app/components/OffersSection.tsx
"use client";

import React from "react";
import { outboundClick } from "@/lib/ga";

export type Offer = {
  url: string;
  store?: string;
  price?: number;
  currency?: string;
  in_stock?: boolean | null;
};

type NormalizedOffer = {
  href: string;
  storeLabel: string;
  price?: number;
  currency?: string; // ISO-ish (USD/EUR/GBP) if provided
  inStock: boolean | null; // keep unknown explicitly
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
  // Accept common ISO codes like USD/EUR/GBP, and also e.g. "USDT" (4)
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
    // allow absolute https/http; allow relative if you ever pass "/go/offer"
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const u = new URL(s, base);
    // hard stop: only allow http(s)
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function formatPrice(price?: number, currency?: string): string | null {
  if (typeof price !== "number") return null;

  // Prefer Intl formatting for known 3-letter codes
  if (currency && currency.length === 3) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        currencyDisplay: "symbol",
        maximumFractionDigits: 2,
      }).format(price);
    } catch {
      // fall through
    }
  }

  // Fallback
  const rounded = Number(price.toFixed(2));
  return currency ? `${currency} ${rounded}` : `$${rounded}`;
}

export function summarizeStock(offers: NormalizedOffer[]): StockSummary {  if (offers.length === 0) return "unknown";

  const anyTrue = offers.some((o) => o.inStock === true);
  if (anyTrue) return "in";

  const anyNull = offers.some((o) => o.inStock === null);
  if (anyNull) return "unknown";

  const anyFalse = offers.some((o) => o.inStock === false);
  if (anyFalse) return "out";

  return "unknown";
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.14] dark:bg-zinc-950">
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Loading offers…</div>
      <div className="mt-3 space-y-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex items-center justify-between gap-3 rounded-2xl border border-black/[.06] bg-zinc-50 p-3 dark:border-white/[.10] dark:bg-zinc-900/30"
          >
            <div className="min-w-0 flex-1">
              <div className="h-4 w-32 rounded-full bg-black/[.08] dark:bg-white/[.10]" />
              <div className="mt-2 h-3 w-24 rounded-full bg-black/[.06] dark:bg-white/[.08]" />
            </div>
            <div className="h-9 w-28 rounded-full bg-black/[.08] dark:bg-white/[.10]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
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
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  const raw = Array.isArray(offers) ? offers : [];

  const normalized: NormalizedOffer[] = raw
    .map((o, i): NormalizedOffer | null => {
      const href = safeUrl(o?.url);
      if (!href) return null;

      const storeLabel = cleanLabel(o?.store, "Store");
      const price = cleanPrice(o?.price);
      const currency = cleanCurrency(o?.currency);

      const inStock =
        o?.in_stock === true ? true : o?.in_stock === false ? false : o?.in_stock == null ? null : null;

      return { href, storeLabel, price, currency, inStock, rank: i + 1 };
    })
    .filter((x): x is NormalizedOffer => x !== null);

  if (normalized.length === 0) {
    return (
      <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/[.14] dark:bg-zinc-950 dark:text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

  // If you want to use this in the parent "pill", export it or lift it up.
  // const stockSummary = summarizeStock(normalized);

  return (
    <ul className="space-y-2">
      {normalized.map((o) => {
        const labelForAnalytics = o.storeLabel || "offer";

        return (
          <li
            key={`${o.href}-${o.rank}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/[.08] bg-white p-3 dark:border-white/[.14] dark:bg-zinc-950"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {o.storeLabel}

                {o.inStock === true ? (
                  <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    In stock
                  </span>
                ) : o.inStock === false ? (
                  <span className="ml-2 rounded-full bg-zinc-500/10 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                    Out of stock
                  </span>
                ) : (
                  <span className="ml-2 rounded-full bg-zinc-500/10 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                    Unknown
                  </span>
                )}
              </div>

              <div className="mt-1 text-xs text-zinc-500">
                {formatPrice(o.price, o.currency) ?? "Price unavailable"}
              </div>
            </div>

            <a
              href={o.href}
              target="_blank"
              rel="noopener noreferrer"
              onMouseDown={() => {
                outboundClick({
                  url: o.href,
                  label: labelForAnalytics,
                  placement,
                  set_num: setNum,
                  offer_rank: o.rank,
                  price: o.price,
                  currency: o.currency,
                });
              }}
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-white dark:text-black"
            >
              View offer →
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// If you want to reuse in a parent header pill later:
// export { summarizeStock };
// export type { StockSummary };