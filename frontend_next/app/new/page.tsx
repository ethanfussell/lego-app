// frontend_next/app/new/page.tsx
import type { Metadata } from "next";
import NewSetsClient from "./NewSetsClient";
import { featuredThemesForMonth, monthKeyFromDate, type MonthKey } from "./featuredThemes";

export const revalidate = 3600; // ISR (1 hour)

type SetLite = {
  set_num: string;
  name?: string | null;
  year?: number | null;
  pieces?: number | null;
  theme?: string | null;
  image_url?: string | null;
  average_rating?: number | null;
  rating_avg?: number | null;
  rating_count?: number | null;
  review_count?: number | null;
  created_at?: string | null;
};

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

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
  params.set("days", "30"); // month window
  params.set("page", "1");
  params.set("limit", "80");

  const url = `${apiBase()}/sets/new?${params.toString()}`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  return normalizeSets(data);
}

const TITLE = "New LEGO set releases this month";
const DESCRIPTION = "Browse newly added LEGO sets from the last 30 days. Updated regularly.";

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
  const featuredThemes = featuredThemesForMonth(monthKey);

  return (
    <NewSetsClient
      initialSets={sets}
      initialError={error}
      monthKey={monthKey}
      featuredThemes={featuredThemes}
    />
  );
}