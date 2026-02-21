// frontend_next/app/years/[year]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ThemesClient from "@/app/themes/ThemesClient";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { themeToSlug } from "@/lib/slug";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

export const dynamic = "force-static";
export const revalidate = 3600;

type JsonLdObject = Record<string, unknown>;
type SP = Record<string, string | string[] | undefined>;

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

type UnknownRecord = Record<string, unknown>;

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function buildBreadcrumbJsonLd(items: Array<{ label: string; href: string }>, baseUrl: string): JsonLdObject {
  const normBase = String(baseUrl || "").replace(/\/+$/, "") || "http://localhost:3000";
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: it.label,
      item: new URL(it.href, normBase).toString(),
    })),
  };
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getArrayField(v: unknown, key: string): unknown[] | null {
  if (!isRecord(v)) return null;
  const val = v[key];
  return Array.isArray(val) ? val : null;
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

function yearBounds() {
  return { min: 1980, max: new Date().getFullYear() };
}

function qsBase(year: number, p: number) {
  const qs = new URLSearchParams(p > 1 ? { page: String(p) } : {}).toString();
  return qs ? `/years/${year}?${qs}` : `/years/${year}`;
}

// numbered pagination with ellipses, e.g. 1 … 6 7 [8] 9 10 … 30
function buildPageList(current: number, totalPages: number) {
  const out: Array<number | "..."> = [];
  const add = (x: number | "...") => {
    if (out.length === 0 || out[out.length - 1] !== x) out.push(x);
  };

  if (totalPages <= 1) return out;

  const windowSize = 2;
  const start = Math.max(2, current - windowSize);
  const end = Math.min(totalPages - 1, current + windowSize);

  add(1);
  if (start > 2) add("...");
  for (let p = start; p <= end; p++) add(p);
  if (end < totalPages - 1) add("...");
  add(totalPages);

  return out;
}

function isSetSummary(x: unknown): x is SetSummary {
  if (!isRecord(x)) return false;

  const sn = x["set_num"];
  const name = x["name"];

  if (typeof sn !== "string" || !sn.trim()) return false;
  if (typeof name !== "string" || !name.trim()) return false;

  return true;
}

function normalizeSetSummaryArray(data: unknown): SetSummary[] {
  const arr = Array.isArray(data) ? data : getArrayField(data, "results") ?? [];
  return arr.filter(isSetSummary);
}

function topThemesFromRows(rows: SetSummary[], max = 3) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const r of rows) {
    const t = String(r.theme ?? "").trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }

  return out;
}

type FetchOk = { kind: "ok"; rows: SetSummary[]; totalCount: number | null };
type FetchNotFound = { kind: "notfound" };
type FetchDegraded = { kind: "degraded"; rows: SetSummary[]; totalCount: null };

async function fetchSetsByYear(year: number, page: number, limit: number): Promise<FetchOk | FetchNotFound | FetchDegraded> {
  const params = new URLSearchParams();
  params.set("year", String(year));
  if (page > 1) params.set("page", String(page));
  params.set("limit", String(limit));

  // Server component: go to backend directly (avoids proxy/cache surprises).
  const url = `${apiBase()}/sets?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
  } catch {
    return { kind: "degraded", rows: [], totalCount: null };
  }

  if (res.status === 404) return { kind: "notfound" };
  if (!res.ok) return { kind: "degraded", rows: [], totalCount: null };

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    return { kind: "degraded", rows: [], totalCount: null };
  }

  const rows = normalizeSetSummaryArray(data);

  const header = res.headers.get("x-total-count") || res.headers.get("X-Total-Count");
  const parsed = header ? Number(header) : NaN;
  const totalCount = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

  return { kind: "ok", rows, totalCount };
}

// ✅ metadata depends ONLY on params (cache-friendly)
export async function generateMetadata({
  params,
}: {
  params: { year: string } | Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;

  const { min, max } = yearBounds();
  const y = toInt(String(year), NaN);

  const validYear = Number.isFinite(y) && y >= min && y <= max;

  const title = validYear ? `Sets from ${y}` : "Sets by year";
  const description = validYear
    ? `Browse LEGO sets released in ${y}.`
    : `Browse LEGO sets by release year on ${SITE_NAME}.`;

  const canonical = validYear ? qsBase(y, 1) : "/years";

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

export default async function YearPage({
  params,
  searchParams,
}: {
  params: { year: string } | Promise<{ year: string }>;
  searchParams?: SP | Promise<SP>;
}) {
  const { year } = await params;
  const sp = (await searchParams) ?? ({} as SP);

  const { min, max } = yearBounds();
  const y = toInt(String(year), NaN);

  // Invalid year
  if (!Number.isFinite(y) || y < min || y > max) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Years", href: "/years" },
            { label: "Invalid year" },
          ]}
        />

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Invalid year</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Please choose a year between {min} and {max}.
        </p>

        <Link href="/years" className="mt-4 inline-block text-sm font-semibold hover:underline">
          ← Back to years
        </Link>
      </div>
    );
  }

  const requestedPage = Math.max(1, toInt(first(sp, "page") || "1", 1));
  const limit = 36;

  const firstPass = await fetchSetsByYear(y, requestedPage, limit);

  // Only true invalid year from backend -> 404
  if (firstPass.kind === "notfound") notFound();

  // Degraded: DO NOT crash, DO NOT soft-404. Render page with empty grid + hints.
  if (firstPass.kind === "degraded") {
    const breadcrumbItems = [
      { label: "Home", href: "/" },
      { label: "Years", href: "/years" },
      { label: String(y), href: `/years/${y}` },
    ];
    const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbItems, siteBase());

    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Years", href: "/years" }, { label: String(y) }]} />

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold">
          <Link href="/themes" className="text-zinc-900 hover:underline dark:text-zinc-50">
            Browse themes →
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{y}</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              We couldn’t load sets right now. Try refreshing in a bit.
            </p>
          </div>

          <Link href="/years" className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
            ← All years
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-black/[.08] bg-white p-5 text-sm text-zinc-600 shadow-sm dark:border-white/[.14] dark:bg-zinc-950 dark:text-zinc-300">
          If this keeps happening, it usually means the backend is temporarily unavailable.
        </div>
      </div>
    );
  }

  // Ok path
  const totalPages =
    firstPass.totalCount != null ? Math.max(1, Math.ceil(firstPass.totalCount / limit)) : null;

  // If we know total pages and the user requested > last page, redirect to canonical last page
  if (totalPages != null && requestedPage > totalPages) {
    redirect(qsBase(y, totalPages));
  }

  const page = requestedPage;
  const rows = firstPass.rows;
  const totalCount = firstPass.totalCount;

  const hasPrev = page > 1;
  const hasNext = totalPages != null ? page < totalPages : rows.length === limit;

  const pageList = totalPages && totalPages > 1 ? buildPageList(page, totalPages) : [];

  const firstHref = qsBase(y, 1);
  const lastHref = totalPages ? qsBase(y, totalPages) : qsBase(y, page);

  const topThemes = topThemesFromRows(rows, 3);

  // No results (page 1 only)
  if (page === 1 && rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Years", href: "/years" }, { label: String(y) }]} />

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{y}</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No sets found for this year.</p>
          </div>

          <Link href="/years" className="text-sm font-semibold hover:underline">
            ← All years
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold">
          <Link href="/themes" className="text-zinc-900 hover:underline dark:text-zinc-50">
            Browse themes →
          </Link>
        </div>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Years", href: "/years" },
    { label: String(y), href: `/years/${y}` },
  ];
  const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbItems, siteBase());

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Years", href: "/years" }, { label: String(y) }]} />

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold">
        <Link href="/themes" className="text-zinc-900 hover:underline dark:text-zinc-50">
          Browse themes →
        </Link>

        {topThemes.map((t) => (
          <Link key={t} href={`/themes/${themeToSlug(t)}`} className="text-zinc-900 hover:underline dark:text-zinc-50">
            {t} →
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{y}</h1>
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Page {page}
            {totalPages ? <span className="ml-1">of {totalPages}</span> : null}
            {typeof totalCount === "number" ? <span className="ml-2">• {totalCount} sets</span> : null}
          </div>
        </div>

        <Link href="/years" className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
          ← All years
        </Link>
      </div>

      <ThemesClient sets={rows} />

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={firstHref}
            aria-disabled={page <= 1}
            className={`rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold dark:border-white/[.145] dark:bg-black ${
              page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            « First
          </Link>

          <Link
            href={qsBase(y, Math.max(1, page - 1))}
            aria-disabled={!hasPrev}
            className={`rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold dark:border-white/[.145] dark:bg-black ${
              !hasPrev ? "pointer-events-none opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            ← Prev
          </Link>

          <Link
            href={qsBase(y, page + 1)}
            aria-disabled={!hasNext}
            className={`rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold dark:border-white/[.145] dark:bg-black ${
              !hasNext ? "pointer-events-none opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            Next →
          </Link>

          <Link
            href={lastHref}
            aria-disabled={totalPages != null ? page >= totalPages : !hasNext}
            className={`rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold dark:border-white/[.145] dark:bg-black ${
              totalPages != null
                ? page >= totalPages
                  ? "pointer-events-none opacity-50"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                : !hasNext
                  ? "pointer-events-none opacity-50"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            Last »
          </Link>
        </div>

        {pageList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {pageList.map((p, idx) =>
              p === "..." ? (
                <span key={`dots-${idx}`} className="px-2 text-sm text-zinc-500">
                  …
                </span>
              ) : (
                <Link
                  key={p}
                  href={qsBase(y, p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`h-9 min-w-9 rounded-full border px-3 text-sm font-semibold dark:border-white/[.2] ${
                    p === page
                      ? "border-black/40 bg-black text-white dark:border-white/40 dark:bg-white dark:text-black"
                      : "border-black/[.12] hover:bg-zinc-50 dark:border-white/[.2] dark:hover:bg-zinc-900"
                  }`}
                >
                  {p}
                </Link>
              )
            )}
          </div>
        ) : (
          <div className="text-sm text-zinc-500">{hasNext ? "More pages available" : "No more pages"}</div>
        )}
      </div>
    </div>
  );
}