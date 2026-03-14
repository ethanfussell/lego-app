// frontend_next/app/page.tsx
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import { isRecord } from "@/lib/types";
import HomeClient from "./HomeClient";
import QuickJump from "./components/QuickJump";
import { SITE_NAME } from "@/lib/url";
const HOME_TITLE = `Home | ${SITE_NAME}`;
const HOME_DESC = "Browse, rate, and track your LEGO collection. Discover new releases and top-rated sets.";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESC,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESC,
    url: "/",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESC,
    images: ["/opengraph-image"],
  },
};

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number | null;
  theme?: string;
  image_url?: string | null;
  rating_avg?: number | null;
  rating_count?: number | null;
};

type PublicList = {
  id: number | string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  items_count?: number | null;
  owner?: string | null;
  owner_username?: string | null;
};

export type SiteStats = {
  set_count: number;
  user_count: number;
  review_count: number;
};

function toSetArray(raw: unknown): SetLite[] {
  const arr = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray((raw as Record<string, unknown>).results) ? (raw as Record<string, unknown>).results as unknown[] : [];
  return arr.filter((x): x is SetLite => isRecord(x) && typeof (x as Record<string, unknown>).set_num === "string");
}

function toListArray(raw: unknown): PublicList[] {
  const arr = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray((raw as Record<string, unknown>).results) ? (raw as Record<string, unknown>).results as unknown[] : [];
  return arr.filter((x): x is PublicList => isRecord(x) && ((x as Record<string, unknown>).id != null));
}

function toStats(raw: unknown): SiteStats {
  if (isRecord(raw)) {
    return {
      set_count: typeof raw.set_count === "number" ? raw.set_count : 0,
      user_count: typeof raw.user_count === "number" ? raw.user_count : 0,
      review_count: typeof raw.review_count === "number" ? raw.review_count : 0,
    };
  }
  return { set_count: 0, user_count: 0, review_count: 0 };
}

function formatStatNumber(n: number): string {
  if (n >= 1000) return `${Math.floor(n / 1000).toLocaleString()},${String(n % 1000).padStart(3, "0").slice(0, -2)}00+`;
  return `${n}+`;
}

export const revalidate = 60; // ISR: regenerate page at most every 60 seconds

export default async function Page() {
  const [newSetsRaw, popularSetsRaw, listsRaw, statsRaw, dealsRaw] = await Promise.all([
    apiFetch<unknown>("/sets/new?days=60&limit=12").catch(() => []),
    apiFetch<unknown>("/sets?sort=rating&order=desc&limit=12").catch(() => []),
    apiFetch<unknown>("/lists/public").catch(() => []),
    apiFetch<unknown>("/site-stats").catch(() => ({})),
    apiFetch<unknown>("/sets/deals?limit=1&sort=discount&order=desc").catch(() => ({ results: [] })),
  ]);

  const newSets = toSetArray(newSetsRaw);
  const popularSets = toSetArray(popularSetsRaw);
  const lists = toListArray(listsRaw);
  const stats = toStats(statsRaw);
  const topDeal = toSetArray(dealsRaw)[0] ?? null;

  return (
    <>
      <QuickJump />
      <HomeClient
        newSets={newSets}
        popularSets={popularSets}
        lists={lists}
        stats={stats}
        topDeal={topDeal}
        formattedStats={{
          sets: stats.set_count > 0 ? formatStatNumber(stats.set_count) : "19,000+",
          users: stats.user_count > 0 ? formatStatNumber(stats.user_count) : "500+",
          reviews: stats.review_count > 0 ? formatStatNumber(stats.review_count) : "2,000+",
        }}
      />
    </>
  );
}
