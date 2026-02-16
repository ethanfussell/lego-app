// frontend_next/lib/slug.ts

export function themeToSlug(theme: unknown): string {
  const s = String(theme ?? "").trim();
  if (!s) return "";

  // Escape real hyphens first, then convert spaces to hyphens.
  // This makes the transform reversible.
  const escaped = s.replace(/-/g, "--").replace(/\s+/g, "-");

  // Encode anything else (&, /, etc.) safely.
  return encodeURIComponent(escaped);
}

export function slugToTheme(slug: unknown): string {
  const raw = String(slug ?? "").trim();
  if (!raw) return "";

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // keep raw if decode fails
  }

  // Reverse in the correct order:
  // 1) protect escaped hyphens
  // 2) hyphens -> spaces
  // 3) restore real hyphens
  const HY = "\u0000"; // placeholder
  return decoded.replace(/--/g, HY).replace(/-/g, " ").replaceAll(HY, "-").trim();
}