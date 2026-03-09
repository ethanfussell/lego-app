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
  average_rating?: number | null;
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

function toSetArray(raw: unknown): SetLite[] {
  const arr = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray((raw as Record<string, unknown>).results) ? (raw as Record<string, unknown>).results as unknown[] : [];
  return arr.filter((x): x is SetLite => isRecord(x) && typeof (x as Record<string, unknown>).set_num === "string");
}

function toListArray(raw: unknown): PublicList[] {
  const arr = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray((raw as Record<string, unknown>).results) ? (raw as Record<string, unknown>).results as unknown[] : [];
  return arr.filter((x): x is PublicList => isRecord(x) && ((x as Record<string, unknown>).id != null));
}

export const revalidate = 60; // ISR: regenerate page at most every 60 seconds

export default async function Page() {
  // Fetch all 3 data sources in parallel on the server
  const [newSetsRaw, popularSetsRaw, listsRaw] = await Promise.all([
    apiFetch<unknown>("/sets/new?days=60&limit=12").catch(() => []),
    apiFetch<unknown>("/sets?sort=rating&order=desc&limit=12").catch(() => []),
    apiFetch<unknown>("/lists/public").catch(() => []),
  ]);

  const newSets = toSetArray(newSetsRaw);
  const popularSets = toSetArray(popularSetsRaw);
  const lists = toListArray(listsRaw);

  return (
    <>
      <QuickJump />
      <HomeClient newSets={newSets} popularSets={popularSets} lists={lists} />
    </>
  );
}
