// frontend_next/lib/types.ts

export type JsonPrimitive = string | number | boolean | null;

// JSON value (recursive)
export type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };

// A plain object with unknown values (good default for untrusted payloads)
export type UnknownRecord = Record<string, unknown>;

export function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isString(v: unknown): v is string {
  return typeof v === "string";
}

export function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function getString(obj: UnknownRecord, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

export function getNumber(obj: UnknownRecord, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Like getString but trims whitespace and returns null (not undefined) for missing/empty. */
export function getTrimmedString(obj: UnknownRecord, key: string): string | null {
  const v = obj[key];
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

/** Like getNumber but returns null (not undefined) for missing/non-finite. */
export function getFiniteNumber(obj: UnknownRecord, key: string): number | null {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Trim an unknown value to a non-empty string or null. Useful for coercing API fields. */
export function asTrimmedString(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

/** Coerce an unknown value to a finite number or null. */
export function asFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Extract results array from either a plain array or { results: [...] } response. */
export function pickRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.results)) return data.results as unknown[];
  return [];
}

/** Lightweight set shape shared across page files and components. */
export type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number | null;
  num_parts?: number | null;
  theme?: string;
  image_url?: string | null;

  // global ratings
  rating_avg?: number | null;
  rating_count?: number | null;

  // user rating
  user_rating?: number | null;

  // pricing
  price_from?: number | null;
  price?: number | null;
  original_price?: number | null;
  sale_price?: number | null;
  sale_price_from?: number | null;
  retail_price?: number | null;

  // dates & availability
  launch_date?: string | null;
  exit_date?: string | null;
  retirement_date?: string | null;
  retirement_status?: string | null;

  // deal-specific fields
  savings?: number | null;
  discount_pct?: number | null;

  // custom tag (e.g. "GWP", "Insider Reward")
  set_tag?: string | null;
};