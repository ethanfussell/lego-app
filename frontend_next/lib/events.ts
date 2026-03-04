// frontend_next/lib/events.ts

export type AffiliateClickEvent = {
  event: "affiliate_click";
  url: string;
  label?: string;
  placement?: string;
  set_num?: string;
  offer_rank?: number;
  price?: number;
  currency?: string;
  conversion?: boolean;
  ts: number;
};

export type CtaEvent = {
  event: "cta_impression" | "cta_click" | "cta_complete";
  cta_id: "hero_track" | "after_offers_alerts";
  variant: "A" | "B";
  placement: "set_hero" | "after_offers";
  set_num: string;
  ts: number;
};

type AnyEvent = AffiliateClickEvent | CtaEvent;

function shouldDebugEvents(): boolean {
  // Enable locally by setting NEXT_PUBLIC_DEBUG_EVENTS=1 in .env.local
  if (typeof process !== "undefined") {
    const v = process.env.NEXT_PUBLIC_DEBUG_EVENTS;
    if (v === "1" || v === "true") return true;
  }
  return false;
}

export function logEvent(e: AnyEvent) {
  // v1: console only (later: POST /events)
  if (!shouldDebugEvents()) return;
  console.info("[event]", e);
}

export function ctaImpression(e: Omit<CtaEvent, "event" | "ts">) {
  logEvent({ event: "cta_impression", ts: Date.now(), ...e });
}
export function ctaClick(e: Omit<CtaEvent, "event" | "ts">) {
  logEvent({ event: "cta_click", ts: Date.now(), ...e });
}
export function ctaComplete(e: Omit<CtaEvent, "event" | "ts">) {
  logEvent({ event: "cta_complete", ts: Date.now(), ...e });
}

/**
 * Persisted affiliate click payload -> POST /events/affiliate-click
 * Required fields match your Friday checklist:
 * - set_num, store, price, page_path
 * Plus:
 * - offer_rank, currency (useful for debugging/analytics)
 */
export type AffiliateClickPayload = {
  set_num: string;
  store: string;
  price: number | null;
  page_path: string;

  offer_rank?: number | null;
  currency?: string | null;
};

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
}

export function trackAffiliateClick(payload: AffiliateClickPayload) {
  const url = `${apiBase()}/events/affiliate-click`;
  const body = JSON.stringify(payload);

  // Best effort: survives navigation
  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" });
    (navigator as any).sendBeacon(url, blob);
    return;
  }

  // Fallback
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}