// frontend_next/app/themes/page.tsx
import type { Metadata } from "next";
import { apiBase } from "@/lib/api";
import { siteBase, SITE_NAME } from "@/lib/url";
import ThemesPageClient from "./ThemesPageClient";

export const dynamic = "force-dynamic";

type ThemeRow = { theme: string; set_count: number; image_url?: string | null };

export async function generateMetadata(): Promise<Metadata> {
  const title = "Browse LEGO themes";
  const description = "Browse LEGO themes and find sets by theme.";
  const canonicalPath = "/themes";

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: `Browse LEGO themes | ${SITE_NAME}`,
      description,
      url: canonicalPath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `Browse LEGO themes | ${SITE_NAME}`,
      description,
    },
  };
}

async function fetchAllThemes(): Promise<ThemeRow[]> {
  const base = apiBase();
  const url = `${base}/themes?limit=200`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[themes] fetchAllThemes failed: ${res.status} from ${url}`);
      return [];
    }
    const data: unknown = await res.json();
    const rows = Array.isArray(data) ? (data as ThemeRow[]) : [];
    const withImg = rows.filter((r) => r.image_url).length;
    console.log(`[themes] fetchAllThemes: ${rows.length} themes, ${withImg} with images, url=${url}`);
    return rows;
  } catch (e) {
    console.error(`[themes] fetchAllThemes error:`, e);
    return [];
  }
}

async function fetchActiveThemes(): Promise<ThemeRow[]> {
  const base = apiBase();
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 2;
  const url = `${base}/themes?limit=200&min_year=${minYear}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[themes] fetchActiveThemes failed: ${res.status} from ${url}`);
      return [];
    }
    const data: unknown = await res.json();
    const rows = Array.isArray(data) ? (data as ThemeRow[]) : [];
    const withImg = rows.filter((r) => r.image_url).length;
    console.log(`[themes] fetchActiveThemes: ${rows.length} themes, ${withImg} with images, url=${url}`);
    return rows;
  } catch (e) {
    console.error(`[themes] fetchActiveThemes error:`, e);
    return [];
  }
}

export default async function ThemesIndexPage() {
  const [allThemes, activeThemes] = await Promise.all([
    fetchAllThemes(),
    fetchActiveThemes(),
  ]);

  return (
    <ThemesPageClient allThemes={allThemes} activeThemes={activeThemes} />
  );
}
