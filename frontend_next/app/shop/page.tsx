// frontend_next/app/shop/page.tsx
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import { isRecord, type SetLite } from "@/lib/types";
import { siteBase } from "@/lib/url";
import ShopClient from "./ShopClient";

export const revalidate = 300; // 5-min ISR

const TITLE = "Shop LEGO Sets";
const DESCRIPTION =
  "Browse new releases, deals, and retiring sets. Find your next LEGO build.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/shop" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/shop", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

/* ── helpers ───────────────────────────────────────────── */

function isSetLite(x: unknown): x is SetLite {
  return isRecord(x) && typeof (x as Record<string, unknown>).set_num === "string";
}

function toSetArray(raw: unknown): SetLite[] {
  if (Array.isArray(raw)) return raw.filter(isSetLite);
  if (isRecord(raw) && Array.isArray((raw as Record<string, unknown>).results)) {
    return ((raw as Record<string, unknown>).results as unknown[]).filter(isSetLite);
  }
  return [];
}

/* ── page ──────────────────────────────────────────────── */

export default async function Page() {
  const [newRaw, dealsRaw, retiringRaw] = await Promise.all([
    apiFetch<unknown>("/sets/new?page=1&limit=10&days=365").catch(() => []),
    apiFetch<unknown>("/sets/deals?limit=10&sort=discount&order=desc").catch(
      () => ({ results: [] }),
    ),
    apiFetch<unknown>("/sets/retiring?limit=10").catch(() => []),
  ]);

  return (
    <ShopClient
      newSets={toSetArray(newRaw)}
      saleSets={toSetArray(dealsRaw)}
      retiringSets={toSetArray(retiringRaw)}
    />
  );
}
