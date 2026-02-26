// frontend_next/app/themes/[themeSlug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ThemeDetailClient from "./ThemeDetailClient";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { slugToTheme } from "@/lib/slug";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";
const DEFAULT_LIMIT = 36;

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

/**
 * IMPORTANT:
 * Next route params are decoded (e.g. "Make-&-Create"), but canonical URLs
 * should use the encoded path segment (e.g. "Make-%26-Create").
 */
function canonicalFor(decodedThemeSlug: string) {
  return `/themes/${encodeURIComponent(decodedThemeSlug)}`;
}

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

function isSetSummary(x: unknown): x is SetSummary {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { set_num?: unknown; name?: unknown };
  return typeof o.set_num === "string" && o.set_num.trim() !== "" && typeof o.name === "string";
}

function toSetSummaryArray(x: unknown): SetSummary[] {
  if (Array.isArray(x)) return x.filter(isSetSummary);
  if (typeof x === "object" && x !== null) {
    const r = (x as { results?: unknown }).results;
    return Array.isArray(r) ? r.filter(isSetSummary) : [];
  }
  return [];
}

// ✅ metadata depends ONLY on params (cache-friendly)
export async function generateMetadata({
  params,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
}): Promise<Metadata> {
  const { themeSlug } = await params;

  const themeName = slugToTheme(themeSlug);
  const title = `${themeName} sets`;
  const description = `Browse LEGO sets in the ${themeName} theme.`;
  const canonical = canonicalFor(themeSlug);

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical },
    twitter: { card: "summary", title, description },
    openGraph: { title, description, url: canonical, type: "website" },
  };
}

async function fetchThemePage1(themeName: string): Promise<SetSummary[] | "notfound"> {
  const qs = new URLSearchParams({
    page: "1",
    limit: String(DEFAULT_LIMIT),
    sort: "relevance",
    order: "desc",
  });

  const url = `${apiBase()}/themes/${encodeURIComponent(themeName)}/sets?${qs.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      next: { revalidate: 3600 }, // ISR
    });
  } catch {
    // degraded: still render the page (not 404)
    return [];
  }

  if (res.status === 404) return "notfound";
  if (!res.ok) return []; // degraded: still render the page (not 404)

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return [];
  }

  return toSetSummaryArray(data);
}

// ✅ try to make route cacheable via ISR
export const revalidate = 3600;
// 🔑 force static shell (otherwise Next/Vercel will keep sending private/no-store)
export const dynamic = "force-static";
export const dynamicParams = true;
export const fetchCache = "force-cache";

export default async function ThemeSetsPage({
  params,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
}) {
  const { themeSlug } = await params;

  // themeSlug is decoded from the URL segment; convert to display name for UI + API calls.
  const themeName = slugToTheme(themeSlug);

  const rows = await fetchThemePage1(themeName);
  if (rows === "notfound") notFound();

  const initialQuery: Query = { page: 1, limit: DEFAULT_LIMIT, sort: "relevance", order: "desc" };

  // Pass an encoded slug to the client so any URL building stays correct (& -> %26, etc.)
  const themeSlugEncoded = encodeURIComponent(themeSlug);

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Themes", href: "/themes" },
            { label: themeName },
          ]}
        />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/themes" className="inline-block text-sm font-semibold hover:underline">
            ← Back to themes
          </Link>
          <Link href="/years" className="inline-block text-sm font-semibold hover:underline">
            Browse by year →
          </Link>
        </div>
      </div>

      <ThemeDetailClient themeSlug={themeSlugEncoded} initialSets={rows} initialQuery={initialQuery} />
    </>
  );
}