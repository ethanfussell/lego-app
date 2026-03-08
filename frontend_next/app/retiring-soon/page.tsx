// frontend_next/app/retiring-soon/page.tsx
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import RetiringSoonClient from "./RetiringSoonClient";
import { siteBase, SITE_NAME } from "@/lib/url";
import { isRecord, type UnknownRecord, type SetLite } from "@/lib/types";
import { unwrapSearchParams, first, type SP } from "@/lib/searchParams";

export const dynamic = "force-static";
export const revalidate = 3600;

type FeedResponse =
  | SetLite[]
  | {
      results?: unknown;
      total?: unknown;
      total_pages?: unknown;
      page?: unknown;
    };

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}): Promise<Metadata> {
  const sp = await unwrapSearchParams(searchParams);
  const page = toInt(first(sp, "page") || "1", 1);

  const title = "Retiring soon";
  const description = "LEGO sets expected to retire soon—browse and add your favorites before they’re gone.";
  const canonicalPath = "/retiring-soon";

  const robots = page > 1 ? ({ index: false, follow: true } as const) : undefined;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    robots,
    openGraph: { title, description, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function isSetLite(x: unknown): x is SetLite {
  return isRecord(x) && typeof x.set_num === "string";
}

function toSetLiteArray(x: unknown): SetLite[] {
  return Array.isArray(x) ? x.filter(isSetLite) : [];
}

function asFeedResponse(x: unknown): FeedResponse {
  if (Array.isArray(x)) return toSetLiteArray(x);
  if (isRecord(x)) return { results: x.results };
  return [];
}

async function fetchRetiringSoonSets(): Promise<SetLite[]> {
  const raw = await apiFetch<unknown>(`/sets/retiring?limit=200`, { cache: "no-store" });
  const data = asFeedResponse(raw);

  const items: SetLite[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: unknown }).results)
      ? toSetLiteArray((data as { results?: unknown }).results)
      : [];

  // Filter out non-standard sets (GWP, minifigures, education, seasonal promos)
  const EXCLUDED_THEMES = new Set(["SPIKE", "LEGO Exclusive", "Seasonal"]);

  return items.filter((s) => {
    if (!s.set_num.trim()) return false;
    const theme = typeof s.theme === "string" ? s.theme.trim() : "";
    if (EXCLUDED_THEMES.has(theme)) return false;
    if (/minifigure/i.test(theme)) return false;
    return true;
  });
}

export default async function Page() {
  let sets: SetLite[] = [];
  let error: string | null = null;

  try {
    sets = await fetchRetiringSoonSets();
  } catch (e: unknown) {
    error = errorMessage(e);
  }

  return <RetiringSoonClient initialSets={sets} initialError={error} />;
}