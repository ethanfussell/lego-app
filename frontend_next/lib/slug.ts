// frontend_next/lib/slug.ts

function normalizeSpaces(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * We must never produce a slug that contains "%2F" (encoded "/"),
 * because many routers treat it like a real path separator and the
 * dynamic route won't match (causes 404).
 *
 * So we encode "/" as a safe token inside the slug and reverse it later.
 */
const SLASH_TOKEN = "__SLASH__";

/**
 * Theme name -> URL-safe slug (stable + reversible)
 *
 * Rules:
 * - Normalize spaces
 * - Replace "/" with SLASH_TOKEN (prevents %2F in the slug)
 * - Spaces become "-"
 * - Literal hyphen "-" becomes "--" (escape so it doesn't decode as a space)
 * - Then URI-encode the whole thing so "&" -> %26, "'" -> %27, "!" -> %21, etc.
 *
 * Examples:
 * - "Star Wars" -> "Star-Wars"
 * - "Exo-Force" -> "Exo--Force"
 * - "Scooby-Doo" -> "Scooby--Doo"
 * - "Make & Create" -> "Make-%26-Create"
 * - "Gabby's Dollhouse" -> "Gabby%27s-Dollhouse"
 * - "Unikitty!" -> "Unikitty%21"
 * - "Dino Attack / Dino 2010" -> "Dino-Attack-__SLASH__-Dino-2010"
 */
export function themeToSlug(theme: unknown): string {
  const raw = typeof theme === "string" ? theme : String(theme ?? "");
  const cleaned = normalizeSpaces(raw);
  if (!cleaned) return "Theme";

  // Prevent %2F in slugs
  const noSlash = cleaned.replace(/\//g, SLASH_TOKEN);

  // Escape literal hyphens so they survive round-trip, then spaces -> "-"
  const escaped = noSlash.replace(/-/g, "--").replace(/ /g, "-");

  // Encode everything that might be unsafe (but NOT "/" because it no longer exists here)
  return encodeURIComponent(escaped);
}

/**
 * Slug -> Theme name (reversible)
 *
 * Reverse of themeToSlug:
 * - decodeURIComponent
 * - protect "--" (escaped hyphen)
 * - "-" -> spaces
 * - restore "--" to "-"
 * - restore SLASH_TOKEN -> "/"
 */
export function slugToTheme(slug: unknown): string {
  const raw = String(slug ?? "").trim();
  if (!raw) return "";

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // keep raw if decode fails
  }

  const HY = "\u0000"; // placeholder for escaped hyphens
  const withSpaces = decoded.replace(/--/g, HY).replace(/-/g, " ").replaceAll(HY, "-").trim();

  // Restore "/" last
  return withSpaces.replaceAll(SLASH_TOKEN, "/").trim();
}