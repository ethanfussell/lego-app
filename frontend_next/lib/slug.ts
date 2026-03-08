// frontend_next/lib/slug.ts

const SLASH_TOKEN = "__SLASH__";

function normalizeSpaces(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function toTitleCaseWords(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/**
 * Theme name -> URL slug
 *
 * mode="route" (DEFAULT): matches app routing, SEO-friendly
 * - lowercase
 * - spaces -> "-"
 * - "&" -> "and"
 * - strip quotes/apostrophes
 * - strip punctuation (keeps letters/numbers)
 * - "/" becomes "-" (NOT the SLASH_TOKEN)
 *
 * mode="stable": old reversible encoding (stable + reversible)
 * - Normalize spaces
 * - Convert "/" into "__SLASH__"
 * - Escape literal "-" as "--"
 * - Spaces become "-"
 * - encodeURIComponent for the rest
 */
export function themeToSlug(theme: unknown, mode: "route" | "stable" = "route"): string {
  const raw = typeof theme === "string" ? theme : String(theme ?? "");
  let cleaned = normalizeSpaces(raw);
  if (!cleaned) return "theme";

  if (mode === "stable") {
    cleaned = cleaned.replace(/\s*\/\s*/g, ` ${SLASH_TOKEN} `);
    cleaned = normalizeSpaces(cleaned);

    const escapedHyphens = cleaned.replace(/-/g, "--");
    const withDashes = escapedHyphens.replace(/ /g, "-");
    return encodeURIComponent(withDashes);
  }

  // mode === "route"
  // Make a route-safe slug that matches /themes/[themeSlug]
  // Examples:
  // "Star Wars" -> "star-wars"
  // "Make & Create" -> "make-and-create"
  // "Gabby’s Dollhouse" -> "gabbys-dollhouse"
  // "Avatar: The Last Airbender" -> "avatar-the-last-airbender"
  // "Dino Attack / Dino 2010" -> "dino-attack-dino-2010"
  // "Pokémon" -> "pokemon"
  let s = cleaned.toLowerCase();

  // Strip diacritics: é → e, ü → u, etc.
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // normalize slash-like separators to spaces
  s = s.replace(/\s*\/\s*/g, " ");

  // common replacements
  s = s.replace(/&/g, " and ");

  // remove apostrophes/quotes
  s = s.replace(/[‘’"]/g, "");

  // replace any non-alphanumeric with spaces
  s = s.replace(/[^a-z0-9]+/g, " ");

  s = normalizeSpaces(s);
  s = s.replace(/ /g, "-");

  // collapse / trim dashes
  s = s.replace(/-+/g, "-").replace(/^-|-$/g, "");

  return s || "theme";
}

/**
 * Slug -> Theme name
 *
 * Accepts either:
 * - stable slug (old reversible encoding)
 * - route slug (new lowercase)
 */
export function slugToTheme(slug: unknown): string {
  const raw = String(slug ?? "").trim();
  if (!raw) return "";

  // Try stable decode first (it may contain %xx or "__SLASH__" or "--")
  let decoded = raw;
  let decodedOk = false;

  try {
    const d = decodeURIComponent(raw);
    // Heuristic: if decoding changes it or it includes our stable markers, treat as stable
    if (d !== raw || d.includes(SLASH_TOKEN) || d.includes("--")) {
      decoded = d;
      decodedOk = true;
    }
  } catch {
    // ignore
  }

  if (decodedOk) {
    // Stable path: reverse the old encoding
    const HY = "\u0000"; // placeholder
    let s = decoded.replace(/--/g, HY);

    s = s.replace(/-/g, " ");
    s = s.replaceAll(HY, "-");

    s = s.replaceAll(SLASH_TOKEN, "/");
    s = s.replace(/\s*\/\s*/g, " / ");

    return normalizeSpaces(s);
  }

  // Route path: "star-wars" -> "Star Wars"
  // Also handle accidental %xx still present even if heuristic didn't trigger
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {
    // ignore
  }

  s = s.replace(/-/g, " ");
  s = normalizeSpaces(s);

  return toTitleCaseWords(s);
}