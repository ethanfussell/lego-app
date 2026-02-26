// frontend_next/lib/slug.ts

const SLASH_TOKEN = "__SLASH__";

function normalizeSpaces(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Theme name -> URL-safe slug (stable + reversible)
 *
 * Rules:
 * - Normalize spaces
 * - Convert "/" (with or without surrounding spaces) into the token "__SLASH__"
 * - Escape literal "-" as "--"
 * - Spaces become "-"
 * - Then encodeURIComponent so "&" -> %26, "'" -> %27, "!" -> %21, etc.
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
  let cleaned = normalizeSpaces(raw);
  if (!cleaned) return "Theme";

  // Normalize slashes into a token so the slug is path-safe
  cleaned = cleaned.replace(/\s*\/\s*/g, ` ${SLASH_TOKEN} `);
  cleaned = normalizeSpaces(cleaned);

  // Escape literal hyphens so they survive round-trip
  const escapedHyphens = cleaned.replace(/-/g, "--");

  // Spaces become hyphens
  const withDashes = escapedHyphens.replace(/ /g, "-");

  // Encode everything else (&, ', !, etc.)
  return encodeURIComponent(withDashes);
}

/**
 * Slug -> Theme name (reverse of themeToSlug)
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

  // Protect escaped hyphens first
  const HY = "\u0000"; // placeholder
  let s = decoded.replace(/--/g, HY);

  // Turn separators back into spaces
  s = s.replace(/-/g, " ");

  // Restore literal hyphens
  s = s.replaceAll(HY, "-");

  // Restore slash token (keep nice spacing)
  s = s.replaceAll(SLASH_TOKEN, "/");
  s = s.replace(/\s*\/\s*/g, " / ");

  return normalizeSpaces(s);
}