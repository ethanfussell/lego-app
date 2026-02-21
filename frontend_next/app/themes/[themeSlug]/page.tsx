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

function canonicalFor(themeSlug: string) {
  // Keep canonical stable (no ?page=...) so metadata stays cache-friendly
  return `/themes/${themeSlug}`;
}

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  theme?: string | null;
  image_url?: string | null;
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
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: canonical, type: "website" },
    twitter: { card: "summary", title: `${title} | ${SITE_NAME}`, description },
  };
}

async function fetchThemePage1(themeName: string): Promise<SetSummary[] | "notfound"> {
  const qs = new URLSearchParams();
  qs.set("page", "1");
  qs.set("limit", String(DEFAULT_LIMIT));
  qs.set("sort", "relevance");
  qs.set("order", "desc");

  const url = `${apiBase()}/themes/${encodeURIComponent(themeName)}/sets?${qs.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    next: { revalidate: 3600 }, // ISR
  });

  if (res.status === 404) return "notfound";
  if (!res.ok) return []; // degraded: still render the page (not 404)

  const data: unknown = await res.json().catch(() => null);
  return toSetSummaryArray(data);
}

// ✅ make route cacheable via ISR
export const revalidate = 3600;

export default async function ThemeSetsPage({
  params,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
}) {
  const { themeSlug } = await params;

  const themeName = slugToTheme(themeSlug);

  const rows = await fetchThemePage1(themeName);
  if (rows === "notfound") notFound();

  const initialQuery = { page: 1, limit: DEFAULT_LIMIT, sort: "relevance", order: "desc" } as const;

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

      <ThemeDetailClient themeSlug={themeSlug} initialSets={rows} initialQuery={initialQuery} />
    </>
  );
}