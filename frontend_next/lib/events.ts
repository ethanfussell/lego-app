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
  // Default: log only in dev builds (still quiet unless explicitly enabled)
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

