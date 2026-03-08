// frontend_next/app/discover/page.tsx

import type { Metadata } from "next";
import DiscoverHub from "./DiscoverHub";
import { apiBase } from "@/lib/api";
import { siteBase } from "@/lib/url";
import { isRecord, type SetLite } from "@/lib/types";

export const dynamic = "force-static";
export const revalidate = 3600; // ISR — 1 hour

export async function generateMetadata(): Promise<Metadata> {
  const title = "Discover";
  const description =
    "Your LEGO discovery hub — new releases, retiring sets, deals, top-rated builds, featured lists, and more.";
  const canonicalPath = "/discover";

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

/* ── helpers ────────────────────────────────────────────────── */

function isSetLite(x: unknown): x is SetLite {
  return isRecord(x) && typeof x.set_num === "string" && (x.set_num as string).trim().length > 0;
}

function toSetLiteArray(x: unknown): SetLite[] {
  return Array.isArray(x) ? x.filter(isSetLite) : [];
}

function extractSets(raw: unknown): SetLite[] {
  if (Array.isArray(raw)) return toSetLiteArray(raw);
  if (isRecord(raw) && Array.isArray(raw.results)) return toSetLiteArray(raw.results);
  return [];
}

type ThemeItem = { theme: string; set_count?: number };

function extractThemes(raw: unknown): ThemeItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is ThemeItem => isRecord(t) && typeof t.theme === "string",
  );
}

type PublicList = {
  id: number | string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  items_count?: number | null;
  owner?: string | null;
  owner_username?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function extractLists(raw: unknown): PublicList[] {
  const arr = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.results) ? raw.results : [];
  return arr.filter((l): l is PublicList => isRecord(l) && (typeof l.id === "number" || typeof l.id === "string"));
}

/* ── data fetchers (all run server-side in parallel) ────────── */

const base = () => apiBase();
const jsonHeaders = { accept: "application/json" };
const fetchOpts = { headers: jsonHeaders, next: { revalidate } } as const;

async function fetchJSON(path: string): Promise<unknown> {
  try {
    const res = await fetch(`${base()}${path}`, fetchOpts);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchNewReleases(): Promise<SetLite[]> {
  const raw = await fetchJSON("/sets/new?limit=14&days=90");
  return extractSets(raw);
}

async function fetchRetiringSoon(): Promise<SetLite[]> {
  const raw = await fetchJSON("/sets/retiring?limit=14");
  return extractSets(raw);
}

async function fetchComingSoon(): Promise<SetLite[]> {
  const raw = await fetchJSON("/sets/coming-soon?limit=14");
  return extractSets(raw);
}

async function fetchTopRated(): Promise<SetLite[]> {
  const raw = await fetchJSON("/sets?sort=rating&order=desc&min_rating=4.0&limit=14");
  return extractSets(raw);
}

async function fetchPopular(): Promise<SetLite[]> {
  const raw = await fetchJSON("/sets?sort=rating&order=desc&limit=14");
  return extractSets(raw);
}

async function fetchThemes(): Promise<ThemeItem[]> {
  const raw = await fetchJSON("/themes?limit=30");
  return extractThemes(raw);
}

async function fetchPublicLists(): Promise<PublicList[]> {
  const raw = await fetchJSON("/lists/public");
  return extractLists(raw);
}

async function fetchSpotlight(): Promise<SetLite | null> {
  // Try admin-configured spotlight first
  const config = await fetchJSON("/sets/new-page-config");
  const spotlightNum =
    isRecord(config) && typeof config.spotlight_set_num === "string"
      ? config.spotlight_set_num.trim()
      : null;

  if (spotlightNum) {
    const raw = await fetchJSON(`/sets/${encodeURIComponent(spotlightNum)}`);
    if (isRecord(raw) && typeof raw.set_num === "string") return raw as unknown as SetLite;
  }

  return null;
}

/* ── page ───────────────────────────────────────────────────── */

export type DiscoverData = {
  newReleases: SetLite[];
  retiringSoon: SetLite[];
  comingSoon: SetLite[];
  topRated: SetLite[];
  popular: SetLite[];
  themes: ThemeItem[];
  lists: PublicList[];
  spotlight: SetLite | null;
};

export default async function Page() {
  const [newReleases, retiringSoon, comingSoon, topRated, popular, themes, lists, spotlight] =
    await Promise.all([
      fetchNewReleases(),
      fetchRetiringSoon(),
      fetchComingSoon(),
      fetchTopRated(),
      fetchPopular(),
      fetchThemes(),
      fetchPublicLists(),
      fetchSpotlight(),
    ]);

  const data: DiscoverData = {
    newReleases,
    retiringSoon,
    comingSoon,
    topRated,
    popular,
    themes,
    lists,
    spotlight,
  };

  return <DiscoverHub data={data} />;
}
