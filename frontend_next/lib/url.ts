// frontend_next/lib/url.ts

/** Canonical site origin (e.g. https://example.com). Trailing slashes are stripped. */
export function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Display name for the site, used in metadata titles. */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

/** Parse an absolute URL string into a URL object, or null on failure. */
export function safeParseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** Validate an unknown value as an absolute URL string, or return "". */
export function safeAbsUrl(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!s) return "";
  try {
    return new URL(s).toString();
  } catch {
    return "";
  }
}
