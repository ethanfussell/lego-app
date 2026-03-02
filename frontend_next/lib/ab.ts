// frontend_next/lib/ab.ts
export type Variant = "A" | "B";

export function variantFromQuery(v: string | null | undefined): Variant | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "A") return "A";
  if (s === "B") return "B";
  return null;
}

export function variantFromKey(key: string): Variant {
  // stable hash -> A/B
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "A" : "B";
}