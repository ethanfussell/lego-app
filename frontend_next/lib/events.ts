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

export function logEvent(e: AffiliateClickEvent | CtaEvent) {
  // v1: console only (later: POST /events)
  // eslint-disable-next-line no-console
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