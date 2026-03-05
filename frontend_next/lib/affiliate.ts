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
  
  const ALLOWED_HOSTS = new Set<string>([
    // start small; add as you onboard programs
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
   * Minimal v1:
   * - drops non-http(s)
   * - optionally blocks unknown domains (you can flip to allow-all later)
   * - adds basic tracking params (utm_*)
   */
  export function buildAffiliateUrl(offer: AffiliateOffer, opts: BuildOpts = {}): string {
    const raw = String(offer?.url || "").trim();
    const u = safeParseUrl(raw);
    if (!u || !isHttp(u)) return "";
  
    const host = normalizeHost(u.hostname);
  
    // Start strict (recommended while you’re testing). If you want allow-all, remove this.
    if (ALLOWED_HOSTS.size > 0 && !ALLOWED_HOSTS.has(host)) {
      // allow subdomains like smile.amazon.com if you add it later
      return "";
    }
  
    // Add basic UTMs for attribution (works even before affiliate programs)
    u.searchParams.set("utm_source", "legoapp");
    u.searchParams.set("utm_medium", "affiliate");
    if (opts.placement) u.searchParams.set("utm_campaign", opts.placement);
    if (opts.setNum) u.searchParams.set("utm_content", opts.setNum);
    if (typeof opts.offerRank === "number") u.searchParams.set("utm_term", String(opts.offerRank));
  
    return u.toString();
  }