// frontend_next/lib/slug.ts

function normalizeSpaces(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Theme name -> URL-safe slug (stable + reversible)
 *
 * Rules:
 * - Spaces become "-"
 * - Literal hyphen "-" becomes "--" (escape so it doesn't turn into a space when decoding)
 * - Then we URI-encode the whole thing so "&" -> %26, "'" -> %27, "!" -> %21, "/" -> %2F, etc.
 *
 * Examples:
 * - "Star Wars" -> "Star-Wars"
 * - "Exo-Force" -> "Exo--Force"
 * - "Scooby-Doo" -> "Scooby--Doo"
 * - "Make & Create" -> "Make-%26-Create"
 * - "Gabby's Dollhouse" -> "Gabby%27s-Dollhouse"
 * - "Unikitty!" -> "Unikitty%21"
 */
export function themeToSlug(theme: unknown): string {
  const raw = typeof theme === "string" ? theme : String(theme ?? "");
  const cleaned = normalizeSpaces(raw);
  if (!cleaned) return "Theme";

  // Escape literal hyphens so they survive round-trip
  const escaped = cleaned.replace(/-/g, "--").replace(/ /g, "-");
  return encodeURIComponent(escaped);
}

/**
 * Slug -> Theme name (reversible)
 *
 * Reverse of themeToSlug:
 * - decodeURIComponent
 * - turn "-" back into spaces
 * - turn "--" back into literal "-"
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

  // Protect escaped hyphens, then convert separators to spaces, then restore hyphens
  const HY = "\u0000"; // placeholder
  return decoded.replace(/--/g, HY).replace(/-/g, " ").replaceAll(HY, "-").trim();
}