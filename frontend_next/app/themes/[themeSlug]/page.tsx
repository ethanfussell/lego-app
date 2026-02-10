// frontend_next/app/themes/[themeSlug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import ThemeDetailClient from "./ThemeDetailClient";

type SP = Record<string, string | string[] | undefined>;

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function first(sp: SP, key: string): string {
  const raw = sp[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v ?? "").trim();
}
function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const themeHasAnySets = cache(async (theme: string): Promise<boolean> => {
  // API expects raw theme name (can include spaces); encode for URL
  const url = `${apiBase()}/themes/${encodeURIComponent(theme)}/sets?limit=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return false;

  const data: unknown = await res.json();
  return Array.isArray(data) && data.length > 0;
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
  searchParams?: SP | Promise<SP>;
}): Promise<Metadata> {
  const { themeSlug } = await params;
  const sp = (await searchParams) ?? ({} as SP);

  const theme = decodeURIComponent(themeSlug);
  const page = toInt(first(sp, "page") || "1", 1);

  const canonical = `/themes/${encodeURIComponent(themeSlug)}` + (page > 1 ? `?page=${page}` : "");
  const title = `${theme} sets`;
  const description =
    page > 1 ? `Browse LEGO sets in the ${theme} theme. Page ${page}.` : `Browse LEGO sets in the ${theme} theme.`;

  return {
    title, // layout template will make it: `${title} | LEGO App`
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function ThemeSetsPage({
  params,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
}) {
  const { themeSlug } = await params;
  const theme = decodeURIComponent(themeSlug);

  // If the theme has no sets, treat as invalid and 404
  const ok = await themeHasAnySets(theme);
  if (!ok) notFound();

  return <ThemeDetailClient themeSlug={themeSlug} />;
}