// frontend_next/lib/affiliate.ts
import { safeParseUrl } from "@/lib/url";

export type AffiliateOffer = {
  url: string;
  store?: string;
  retailer?: string;
  currency?: string;
  price?: number;
};

type BuildOpts = {
  placement?: string; // e.g. "set_detail_shop"
  setNum?: string;
  offerRank?: number;
};

const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || "";

const AMAZON_HOSTS = new Set(["amazon.com", "www.amazon.com"]);

const ALLOWED_HOSTS = new Set<string>([
  "www.lego.com",
  "lego.com",
  "www.amazon.com",
  "amazon.com",
  "www.walmart.com",
  "walmart.com",
  "www.target.com",
  "target.com",
  "www.bestbuy.com",
  "bestbuy.com",
]);

function isHttp(u: URL) {
  return u.protocol === "https:" || u.protocol === "http:";
}

function normalizeHost(host: string) {
  return host.toLowerCase();
}

/**
 * Build an affiliate-tagged URL for a retailer offer.
 * - Validates URL (http/https only, allowlisted hosts)
 * - Appends Amazon Associates tag for amazon.com links
 * - Adds UTM tracking params for attribution
 */
export function buildAffiliateUrl(offer: AffiliateOffer, opts: BuildOpts = {}): string {
  const raw = String(offer?.url || "").trim();
  const u = safeParseUrl(raw);
  if (!u || !isHttp(u)) return "";

  const host = normalizeHost(u.hostname);

  if (ALLOWED_HOSTS.size > 0 && !ALLOWED_HOSTS.has(host)) {
    return "";
  }

  // Amazon Associates tag
  if (AMAZON_TAG && AMAZON_HOSTS.has(host)) {
    u.searchParams.set("tag", AMAZON_TAG);
  }

  // UTM tracking
  u.searchParams.set("utm_source", "bricktrack");
  u.searchParams.set("utm_medium", "affiliate");
  if (opts.placement) u.searchParams.set("utm_campaign", opts.placement);
  if (opts.setNum) u.searchParams.set("utm_content", opts.setNum);
  if (typeof opts.offerRank === "number") u.searchParams.set("utm_term", String(opts.offerRank));

  return u.toString();
}