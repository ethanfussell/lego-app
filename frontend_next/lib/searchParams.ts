// frontend_next/lib/searchParams.ts

export type SP = Record<string, string | string[] | undefined>;

function isPromiseLike<T>(v: unknown): v is PromiseLike<T> {
  return (
    typeof v === "object" &&
    v !== null &&
    "then" in v &&
    typeof (v as { then?: unknown }).then === "function"
  );
}

/** Await a Next.js searchParams value (may be a Promise in Next 16+). */
export async function unwrapSearchParams<T extends object>(p?: T | Promise<T>): Promise<T> {
  if (!p) return {} as T;
  return isPromiseLike<T>(p) ? await p : p;
}

/** Get the first string value from a search-params bag, trimmed. */
export function first(sp: SP, key: keyof SP): string {
  const raw = sp[key as string];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v ?? "").trim();
}
