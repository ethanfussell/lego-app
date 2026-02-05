// frontend_next/lib/ga.ts

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

type EventParams = Record<string, unknown>;

function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const fn = window.gtag;
  return typeof fn === "function" ? fn : null;
}

function cleanString(v: unknown, fallback = ""): string {
  const s = typeof v === "string" ? v.trim() : String(v ?? "").trim();
  return s || fallback;
}

function safeAbsUrl(raw: unknown): string {
  const s = cleanString(raw);
  if (!s) return "";
  try {
    return new URL(s).toString(); // must be absolute
  } catch {
    return "";
  }
}

export function gaEvent(name: string, params?: EventParams) {
  const fn = getGtag();
  if (!fn) return;

  fn("event", name, {
    transport_type: "beacon",
    ...(params ?? {}),
  });
}

export function pageview(pathWithQuery: string) {
  const fn = getGtag();
  if (!fn) return;

  const path = cleanString(pathWithQuery, "/");

  // send_page_view is disabled in layout.tsx, so we send our own SPA pageviews
  fn("event", "page_view", {
    page_location: window.location.origin + path,
    page_path: path,
    page_title: document.title || "(no title)",
    transport_type: "beacon",
  });
}

export type OutboundClickParams = {
  url: string;
  label?: string;
  placement?: string;
  set_num?: string;
} & EventParams;

export function outboundClick(params: OutboundClickParams) {
  const href = safeAbsUrl(params.url);
  if (!href) return;

  const label = cleanString(params.label, "offer");
  const placement = cleanString(params.placement, "unknown");
  const setNum = cleanString(params.set_num);

  // Avoid duplicates by removing the keys we map
  const extra: EventParams = { ...params };
  delete extra.url;
  delete extra.label;
  delete extra.placement;
  delete extra.set_num;

  gaEvent("outbound_click", {
    link_url: href,
    link_text: label,
    placement,
    ...(setNum ? { set_num: setNum } : {}),
    ...extra,
  });
}