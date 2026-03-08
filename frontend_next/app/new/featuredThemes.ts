// frontend_next/app/new/featuredThemes.ts

export type MonthKey =
  `${number}-${"01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12"}`;

/**
 * Pick whatever themes you want each month.
 * Keys are "YYYY-MM".
 */
export const FEATURED_THEMES_BY_MONTH: Partial<Record<MonthKey, string[]>> = {
  "2026-03": ["Friends", "City", "Technic"],
  "2026-04": ["Star Wars", "Harry Potter", "Ninjago"],
};

/** Fallback if a month isn't listed. */
export const DEFAULT_FEATURED_THEMES: string[] = ["Star Wars", "Technic", "City"];

/** Format a Date into "YYYY-MM" (local time). */
export function monthKeyFromDate(d: Date = new Date()): MonthKey {
  const y = d.getFullYear();
  const mNum = d.getMonth() + 1; // 1..12
  const m = String(mNum).padStart(2, "0");

  // Validate at runtime so the cast is safe + obvious
  if (!/^(0[1-9]|1[0-2])$/.test(m)) {
    // should never happen, but keeps TS honest
    throw new Error(`Invalid month computed: ${m}`);
  }

  return `${y}-${m}` as MonthKey;
}

export function featuredThemesForMonth(key: MonthKey): string[] {
  const t = FEATURED_THEMES_BY_MONTH[key];
  return Array.isArray(t) && t.length ? t : DEFAULT_FEATURED_THEMES;
}