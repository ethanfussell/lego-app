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