// frontend_next/app/themes/[themeSlug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ThemeDetailClient from "./ThemeDetailClient";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { slugToTheme, themeToSlug } from "@/lib/slug";

export const revalidate = 3600; // ISR
export const dynamic = "force-static";
export const dynamicParams = true;
export const fetchCache = "force-cache";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";
const DEFAULT_LIMIT = 36;

type Params = { themeSlug: string };

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  theme?: string | null;
  image_url?: string | null;
};

type Query = {
  page: number;
  limit: number;
  sort: string;
  order: string;
};

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
}

function canonicalForTheme(themeSlug: string): string {
  return `/themes/${themeSlug}`;
}

function isSetSummary(x: unknown): x is SetSummary {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { set_num?: unknown; name?: unknown };
  return typeof o.set_num === "string" && o.set_num.trim() !== "" && typeof o.name === "string" && o.name.trim() !== "";
}

function pickRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null && Array.isArray((data as any).results)) return (data as any).results;
  return [];
}

function toSetSummaryArray(data: unknown): SetSummary[] {
  return pickRows(data).filter(isSetSummary);
}

async function fetchThemePage1(themeName: string): Promise<SetSummary[] | "notfound"> {
  const qs = new URLSearchParams();
  qs.set("page", "1");
  qs.set("limit", String(DEFAULT_LIMIT));
  qs.set("sort", "relevance");
  qs.set("order", "desc");

  const url = `${apiBase()}/themes/${encodeURIComponent(themeName)}/sets?${qs.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
  } catch {
    return [];
  }

  if (res.status === 404) return "notfound";
  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  return toSetSummaryArray(data);
}

export async function generateMetadata({
  params,
}: {
  params: Params | Promise<Params>;
}): Promise<Metadata> {
  const { themeSlug } = await Promise.resolve(params);

  const themeName = slugToTheme(themeSlug);
  const base = new URL(siteBase());

  // If we can’t resolve the theme, keep it non-indexable.
  if (!themeName || !themeName.trim()) {
    return {
      title: `Themes | ${SITE_NAME}`,
      description: "Browse LEGO themes.",
      metadataBase: base,
      robots: { index: false, follow: false },
    };
  }

  // Canonical should be derived from the display name so casing/spacing always normalize.
  const canonicalSlug = themeToSlug(themeName);
  const canonicalPath = canonicalForTheme(canonicalSlug);

  const title = `${themeName} LEGO sets | ${SITE_NAME}`;
  const description = `Browse LEGO sets in the ${themeName} theme.`;

  const ogImageUrl = new URL("/opengraph-image", base).toString();

  return {
    title,
    description,
    metadataBase: base,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      siteName: SITE_NAME,
      images: [{ url: ogImageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ThemeSetsPage({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const { themeSlug } = await Promise.resolve(params);

  const themeName = slugToTheme(themeSlug);
  if (!themeName || !themeName.trim()) notFound();

  // Use canonical slug everywhere (links + client fetches)
  const canonicalSlug = themeToSlug(themeName);

  const rows = await fetchThemePage1(themeName);
  if (rows === "notfound") notFound();

  const initialQuery: Query = {
    page: 1,
    limit: DEFAULT_LIMIT,
    sort: "relevance",
    order: "desc",
  };

  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-6 pt-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Themes", href: "/themes" },
            { label: themeName },
          ]}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/themes" className="inline-block text-sm font-semibold hover:text-amber-600 hover:underline">
              ← Back to themes
            </Link>
            <Link href={`/themes/${canonicalSlug}/top`} className="inline-block text-sm font-semibold hover:text-amber-600 hover:underline">
              Top sets in {themeName} →
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/themes/top" className="inline-block text-sm font-semibold hover:text-amber-600 hover:underline">
              Top themes →
            </Link>
            <Link href="/years" className="inline-block text-sm font-semibold hover:text-amber-600 hover:underline">
              Browse by year →
            </Link>
          </div>
        </div>
      </div>

      {/* Pass canonical route slug so client builds URLs consistently */}
      <ThemeDetailClient themeSlug={canonicalSlug} initialSets={rows} initialQuery={initialQuery} />
    </>
  );
}