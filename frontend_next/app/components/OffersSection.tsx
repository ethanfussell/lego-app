"use client";

import React from "react";
import { outboundClick } from "@/lib/ga";

export type Offer = {
  url: string;
  store?: string;
  price?: number; // dollars (or display units)
  currency?: string; // USD, EUR, etc.
  in_stock?: boolean | null; // null/undefined = unknown
};

type NormalizedOffer = {
  href: string;
  storeLabel: string;
  price?: number;
  currency?: string;
  inStock?: boolean; // badge only when known
  rank: number;
};

function safeUrl(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!s) return "";
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return new URL(s, base).toString();
  } catch {
    return "";
  }
}

function cleanText(v: unknown): string {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
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
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function formatPrice(price?: number, currency?: string): string | null {
  if (typeof price !== "number") return null;
  return currency ? `${currency} ${price}` : `$${price}`;
}

const isNormalizedOffer = (x: NormalizedOffer | null): x is NormalizedOffer => x !== null;

export default function OffersSection({
  setNum,
  offers,
  placement = "set_detail_shop",
  emptyMessage = "No offers yet. We’ll show retailers and pricing here when available.",
}: {
  setNum: string;
  offers: Offer[];
  placement?: string;
  emptyMessage?: string;
}) {
  const raw = Array.isArray(offers) ? offers : [];

  const normalized: NormalizedOffer[] = raw
    .map((o, i): NormalizedOffer | null => {
      const href = safeUrl(o?.url);
      if (!href) return null;

      const storeLabel = cleanLabel(o?.store, "Store");
      const price = cleanPrice(o?.price);
      const currency = cleanCurrency(o?.currency);

      // null/undefined = unknown -> undefined (no badge)
      const inStock = typeof o?.in_stock === "boolean" ? o.in_stock : undefined;

      return {
        href,
        storeLabel,
        price,
        currency,
        inStock,
        rank: i + 1,
      };
    })
    .filter(isNormalizedOffer);

  if (normalized.length === 0) {
    return (
      <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/[.14] dark:bg-zinc-950 dark:text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

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
                ) : null}
              </div>

              <div className="mt-1 text-xs text-zinc-500">{formatPrice(o.price, o.currency) ?? "Price unavailable"}</div>
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