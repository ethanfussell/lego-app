// frontend_next/app/new/page.tsx
import type { Metadata } from "next";
import NewSetsClient from "./NewSetsClient";
import { featuredThemesForMonth, monthKeyFromDate, type MonthKey } from "./featuredThemes";
import { apiBase } from "@/lib/api";
import { siteBase } from "@/lib/url";
import type { SetLite } from "@/lib/types";


export const dynamic = "force-dynamic";

function isSetLite(x: unknown): x is SetLite {
  return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
}

function normalizeSets(x: unknown): SetLite[] {
  if (Array.isArray(x)) return x.filter(isSetLite);

  if (typeof x === "object" && x !== null) {
    const r = (x as { results?: unknown }).results;
    if (Array.isArray(r)) return r.filter(isSetLite);
  }

  return [];
}

async function fetchNewSets(): Promise<SetLite[]> {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("limit", "2000");
  params.set("days", "365");

  const url = `${apiBase()}/sets/new?${params.toString()}`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  return normalizeSets(data);
}

async function fetchNewPageConfig(): Promise<{ spotlight_set_num?: string; featured_themes?: string }> {
  const url = `${apiBase()}/sets/new-page-config`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",            // always fresh — admin changes apply immediately
    });
    if (!res.ok) return {};
    const data = await res.json().catch(() => null);
    return data || {};
  } catch {
    return {};
  }
}

const TITLE = "New LEGO releases";
const DESCRIPTION = "Browse the latest LEGO set releases, sorted by official launch date.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/new" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/new", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export default async function Page() {
  let sets: SetLite[] = [];
  let error: string | null = null;

  try {
    sets = await fetchNewSets();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }

  const monthKey = monthKeyFromDate() as MonthKey;

  // Fetch admin settings for /new page (spotlight + featured themes)
  const config = await fetchNewPageConfig();

  // Featured themes: prefer admin setting, fall back to hardcoded config
  let featuredThemes: string[];
  if (config.featured_themes) {
    try {
      const parsed = JSON.parse(config.featured_themes) as Record<string, string[]>;
      featuredThemes = parsed[monthKey] || parsed["default"] || featuredThemesForMonth(monthKey);
    } catch {
      featuredThemes = featuredThemesForMonth(monthKey);
    }
  } else {
    featuredThemes = featuredThemesForMonth(monthKey);
  }

  return (
    <NewSetsClient
      initialSets={sets}
      initialError={error}
      monthKey={monthKey}
      featuredThemes={featuredThemes}
      spotlightSetNum={config.spotlight_set_num || null}
    />
  );
}