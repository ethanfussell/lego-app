// frontend_next/app/components/OffersSection.tsx
"use client";

import React from "react";
import { outboundClick } from "@/lib/ga";

type Offer = {
  url: string;
  store?: string;
  price?: number;
  currency?: string;
};

function safeUrl(raw: unknown) {
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!s) return "";

  try {
    // allow absolute OR relative
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return new URL(s, base).toString();
  } catch {
    return "";
  }
}

function cleanLabel(v: unknown, fallback = "offer") {
  const s = typeof v === "string" ? v.trim() : String(v ?? "").trim();
  return s || fallback;
}

function cleanCurrency(v: unknown) {
  const s = cleanLabel(v, "").toUpperCase();
  if (!s) return undefined;
  if (s.length < 3 || s.length > 4) return undefined; // USD, EUR, KRW, etc.
  return s;
}

function cleanPrice(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default function OffersSection({
  setNum,
  offers,
  placement = "set_detail_shop",
}: {
  setNum: string;
  offers: Offer[];
  placement?: string;
}) {
  const items = Array.isArray(offers) ? offers : [];

  // Normalize once (no double parsing)
  const visible = items
    .map((o, idx) => {
      const href = safeUrl(o?.url);
      return {
        idx,
        href,
        store: o?.store,
        price: cleanPrice(o?.price),
        currency: cleanCurrency(o?.currency),
      };
    })
    .filter((x) => !!x.href);

  if (visible.length === 0) return null;

  return (
    <section id="shop" className="mt-10">
      <h2 className="text-lg font-semibold">Shop</h2>

      <ul className="mt-4 space-y-2">
        {visible.map(({ href, idx, store, price, currency }) => {
          const label = cleanLabel(store, "offer");
          const rank = idx + 1;

          return (
            <li key={`${href}-${rank}`}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onMouseDown={() => {
                  outboundClick({
                    url: href,
                    label,
                    placement,
                    set_num: setNum,
                    offer_rank: rank,
                    price,
                    currency,
                  });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
              >
                {store ? `Buy at ${store}` : "Buy"}
                {typeof price === "number" ? <span className="text-zinc-500">${price}</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}