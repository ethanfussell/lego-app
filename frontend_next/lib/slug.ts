// frontend_next/lib/slug.ts

/**
 * Theme slug rules (reversible):
 * - Spaces become "-"
 * - Characters like "&" and ":" stay URL-encoded (e.g. %26, %3A)
 * - REAL hyphens in the original theme name are double-encoded to avoid ambiguity:
 *     "Exo-Force" -> "Exo%252DForce"
 *   so we can safely decode back to the exact original theme string.
 */

export function themeToSlug(theme: unknown): string {
  const raw = typeof theme === "string" ? theme : String(theme ?? "");
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Theme";

  // 1) Encode everything safely (spaces -> %20, hyphen -> -, etc)
  // 2) Make it pretty + reversible:
  //    - protect real hyphens by double-encoding them
  //    - turn spaces into hyphens
  return encodeURIComponent(cleaned).replace(/-/g, "%252D").replace(/%20/g, "-");
}

export function slugToTheme(slug: unknown): string {
  const raw = String(slug ?? "").trim();
  if (!raw) return "";

  // Reverse:
  // - pretty "-" back to "%20" (spaces)
  // - decodeURIComponent turns "%2D" into "-" (this happens after Next decodes once)
  try {
    return decodeURIComponent(raw.replace(/-/g, "%20")).trim();
  } catch {
    // If decoding fails, fall back to a best-effort string
    return raw.replace(/-/g, " ").trim();
  }
}