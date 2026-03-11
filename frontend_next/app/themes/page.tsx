// frontend_next/app/themes/page.tsx
import type { Metadata } from "next";
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
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const res = await fetch(`${apiBase}/themes?limit=200`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as ThemeRow[]) : [];
}

async function fetchActiveThemes(): Promise<ThemeRow[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 2;
  const res = await fetch(`${apiBase}/themes?limit=200&min_year=${minYear}`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as ThemeRow[]) : [];
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
