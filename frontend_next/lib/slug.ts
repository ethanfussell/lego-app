// frontend_next/lib/slug.ts

// frontend_next/lib/slug.ts

export function themeToSlug(theme: unknown): string {
  const raw = typeof theme === "string" ? theme : String(theme ?? "");
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Theme";

  // URL-safe and reversible:
  // "Make & Create" -> "Make-%26-Create"
  // "Star Wars" -> "Star-Wars"
  return encodeURIComponent(cleaned).replace(/%20/g, "-");
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