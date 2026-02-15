// frontend_next/app/themes/[themeSlug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ThemeDetailClient from "./ThemeDetailClient";
import Breadcrumbs from "@/app/components/Breadcrumbs";

type SP = Record<string, string | string[] | undefined>;

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";
const DEFAULT_LIMIT = 36;

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
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function posInt(raw: string, fallback: number) {
  const n = toInt(raw, fallback);
  return n > 0 ? n : fallback;
}

function canonicalFor(themeSlug: string, page: number) {
  return `/themes/${themeSlug}` + (page > 1 ? `?page=${page}` : "");
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

  const themeName = decodeURIComponent(themeSlug);
  const page = posInt(first(sp, "page") || "1", 1);

  const baseTitle = `${themeName} sets`;
  const title = page > 1 ? `${baseTitle} (Page ${page})` : baseTitle;

  const description =
    page > 1
      ? `Browse LEGO sets in the ${themeName} theme. Page ${page}.`
      : `Browse LEGO sets in the ${themeName} theme.`;

  const canonical = canonicalFor(themeSlug, page);

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

async function fetchThemeSetsWithCount(
  themeName: string,
  page: number,
  limit: number,
  sort: string,
  order: string
): Promise<{ status: number; rows: unknown[]; totalCount: number | null }> {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  qs.set("sort", sort);
  qs.set("order", order);

  const url = `${apiBase()}/themes/${encodeURIComponent(themeName)}/sets?${qs.toString()}`;
  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 404) return { status: 404, rows: [], totalCount: null };
  if (!res.ok) return { status: res.status, rows: [], totalCount: null };

  const data: unknown = await res.json();
  const rows = Array.isArray(data)
    ? data
    : typeof data === "object" && data !== null && Array.isArray((data as any).results)
      ? ((data as any).results as unknown[])
      : [];

  const header = res.headers.get("x-total-count") || res.headers.get("X-Total-Count");
  const parsed = header ? Number(header) : NaN;
  const totalCount = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

  return { status: 200, rows, totalCount };
}

export default async function ThemeSetsPage({
  params,
  searchParams,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
  searchParams?: SP | Promise<SP>;
}) {
  const { themeSlug } = await params;
  const sp = (await searchParams) ?? ({} as SP);

  const themeName = decodeURIComponent(themeSlug);

  const requestedPage = posInt(first(sp, "page") || "1", 1);
  const limit = posInt(first(sp, "limit") || String(DEFAULT_LIMIT), DEFAULT_LIMIT);
  const sort = first(sp, "sort") || "relevance";
  const order = first(sp, "order") || "desc";

  // Fetch requested page so we can read x-total-count and compute totalPages
  const firstPass = await fetchThemeSetsWithCount(themeName, requestedPage, limit, sort, order);

  if (firstPass.status === 404) notFound();
  if (firstPass.status !== 200) notFound();

  const totalPages =
    firstPass.totalCount != null ? Math.max(1, Math.ceil(firstPass.totalCount / limit)) : null;

  // Option A: clamp to last page by redirecting
  if (totalPages != null && requestedPage > totalPages) {
    const qs = new URLSearchParams();

    // keep URLs clean: only include non-defaults
    if (totalPages > 1) qs.set("page", String(totalPages));
    if (limit !== DEFAULT_LIMIT) qs.set("limit", String(limit));
    if (sort !== "relevance") qs.set("sort", sort);
    if (order !== "desc") qs.set("order", order);

    const dest = `/themes/${themeSlug}${qs.toString() ? `?${qs.toString()}` : ""}`;
    redirect(dest);
  }

  const page = requestedPage; // if we didn’t redirect, this is the real page
  const initialSets = firstPass.rows;

  // keep your "page 1 empty => notFound" behavior
  if (page === 1 && initialSets.length === 0) notFound();

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
          <Link
            href="/themes"
            className="inline-block text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            ← Back to themes
          </Link>

          <Link
            href="/years"
            className="inline-block text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            Browse by year →
          </Link>
        </div>
      </div>

      <ThemeDetailClient themeSlug={themeSlug} initialSets={initialSets} />
    </>
  );
}