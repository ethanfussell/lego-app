// frontend_next/app/themes/[themeSlug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

  const canonical = `/themes/${themeSlug}` + (page > 1 ? `?page=${page}` : "");
  const title = `${theme} sets`;
  const description =
    page > 1
      ? `Browse LEGO sets in the ${theme} theme. Page ${page}.`
      : `Browse LEGO sets in the ${theme} theme.`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${title} | ${SITE_NAME}`,
      description,
    },
  };
}

// ✅ THIS default export is required
export default async function ThemeSetsPage({
  params,
  searchParams,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
  searchParams?: SP | Promise<SP>;
}) {
  const { themeSlug } = await params;
  const sp = (await searchParams) ?? ({} as SP);

  const theme = decodeURIComponent(themeSlug);

  const page = toInt(first(sp, "page") || "1", 1);
  const limit = toInt(first(sp, "limit") || "36", 36);
  const sort = first(sp, "sort") || "relevance";
  const order = first(sp, "order") || "desc";

  const url =
    `${apiBase()}/themes/${encodeURIComponent(theme)}/sets` +
    `?page=${page}&limit=${limit}&sort=${encodeURIComponent(sort)}&order=${encodeURIComponent(order)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) notFound();

  const data: unknown = await res.json();
  const initialSets = Array.isArray(data) ? data : [];

  if (page === 1 && initialSets.length === 0) notFound();

  return <ThemeDetailClient themeSlug={themeSlug} initialSets={initialSets} />;
}