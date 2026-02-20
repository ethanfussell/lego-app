// frontend_next/app/themes/[themeSlug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ThemeDetailClient from "./ThemeDetailClient";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { slugToTheme } from "@/lib/slug";

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

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  theme?: string | null;
  image_url?: string | null;
  rating_count?: number | null;
  rating_avg?: number | null;
  average_rating?: number | null;
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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
  searchParams?: SP | Promise<SP>;
}): Promise<Metadata> {
  const { themeSlug } = await params;
  const sp = (await searchParams) ?? ({} as SP);

  const themeName = slugToTheme(themeSlug);
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
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: canonical, type: "website" },
    twitter: { card: "summary", title: `${title} | ${SITE_NAME}`, description },
  };
}

type FetchOk = { kind: "ok"; rows: SetSummary[]; totalCount: number | null };
type FetchNotFound = { kind: "notfound" };
type FetchError = { kind: "error"; status: number };

async function fetchThemeSetsWithCount(args: {
  themeName: string;
  page: number;
  limit: number;
  sort: string;
  order: string;
}): Promise<FetchOk | FetchNotFound | FetchError> {
  const { themeName, page, limit, sort, order } = args;

  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  qs.set("sort", sort);
  qs.set("order", order);

  // themeName MUST be the real theme string (with spaces)
  const url = `${apiBase()}/themes/${encodeURIComponent(themeName)}/sets?${qs.toString()}`;
  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 404) return { kind: "notfound" };
  if (!res.ok) return { kind: "error", status: res.status };

  const data: unknown = await res.json();
  const rows = toSetSummaryArray(data);

  const header = res.headers.get("x-total-count") || res.headers.get("X-Total-Count");
  const parsed = header ? Number(header) : NaN;
  const totalCount = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

  return { kind: "ok", rows, totalCount };
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

  const themeName = slugToTheme(themeSlug);

  const requestedPage = posInt(first(sp, "page") || "1", 1);
  const limit = posInt(first(sp, "limit") || String(DEFAULT_LIMIT), DEFAULT_LIMIT);
  const sort = first(sp, "sort") || "relevance";
  const order = first(sp, "order") || "desc";

  const result = await fetchThemeSetsWithCount({
    themeName,
    page: requestedPage,
    limit,
    sort,
    order,
  });

  // ✅ Only true invalid theme -> 404
  if (result.kind === "notfound") notFound();

  // ✅ API/server problems should NOT become 404 (avoid soft-404 classification)
  if (result.kind === "error") {
    throw new Error(`Theme sets fetch failed (${result.status}) for theme="${themeName}"`);
  }

  const { rows: initialSets, totalCount } = result;

  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / limit)) : null;

  if (totalPages != null && requestedPage > totalPages) {
    const qs = new URLSearchParams();
    if (totalPages > 1) qs.set("page", String(totalPages));
    if (limit !== DEFAULT_LIMIT) qs.set("limit", String(limit));
    if (sort !== "relevance") qs.set("sort", sort);
    if (order !== "desc") qs.set("order", order);

    const dest = `/themes/${themeSlug}${qs.toString() ? `?${qs.toString()}` : ""}`;
    redirect(dest);
  }

  // ✅ IMPORTANT: Do NOT notFound just because there are 0 sets.
  // Render the page; the client can show "No sets found" instead.

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

      <ThemeDetailClient themeSlug={themeSlug} initialSets={initialSets} />
    </>
  );
}