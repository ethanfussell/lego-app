// frontend_next/app/years/[year]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isRecord, type UnknownRecord } from "@/lib/types";

import ThemesClient from "@/app/themes/ThemesClient";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { themeToSlug } from "@/lib/slug";
import { apiBase } from "@/lib/api";
import { siteBase, SITE_NAME } from "@/lib/url";
import { first, type SP } from "@/lib/searchParams";

export const dynamic = "force-static";
export const revalidate = 3600;

type JsonLdObject = Record<string, unknown>;

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

function getArrayField(v: unknown, key: string): unknown[] | null {
  if (!isRecord(v)) return null;
  const val = v[key];
  return Array.isArray(val) ? val : null;
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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { year: string } | Promise<{ year: string }>;
  searchParams?: SP | Promise<SP>;
}): Promise<Metadata> {
  const { year } = await params;
  const sp = (await searchParams) ?? ({} as SP);

  const { min, max } = yearBounds();
  const y = toInt(String(year), NaN);
  const validYear = Number.isFinite(y) && y >= min && y <= max;

  const page = Math.max(1, toInt(first(sp, "page") || "1", 1));

  const title = validYear ? `Sets from ${y}` : "Sets by year";
  const description = validYear ? `Browse LEGO sets released in ${y}.` : `Browse LEGO sets by release year on ${SITE_NAME}.`;

  const canonical = validYear ? qsBase(y, page) : "/years";
  const ogImage = validYear ? `/years/${y}/opengraph-image` : `/opengraph-image`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
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

  if (!Number.isFinite(y) || y < min || y > max) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Years", href: "/years" }, { label: "Invalid year" }]} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Invalid year</h1>
        <p className="mt-2 text-sm text-zinc-9000">
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

  if (firstPass.kind === "notfound") notFound();

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
          <Link href="/themes" className="text-zinc-900 hover:text-amber-600 hover:underline">
            Browse themes →
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{y}</h1>
            <p className="mt-2 text-sm text-zinc-9000">We couldn’t load sets right now. Try refreshing in a bit.</p>
          </div>

          <Link href="/years" className="text-sm font-semibold text-zinc-900 hover:text-amber-600 hover:underline">
            ← All years
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
          If this keeps happening, it usually means the backend is temporarily unavailable.
        </div>
      </div>
    );
  }

  const totalPages = firstPass.totalCount != null ? Math.max(1, Math.ceil(firstPass.totalCount / limit)) : null;

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

  if (page === 1 && rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Years", href: "/years" }, { label: String(y) }]} />

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{y}</h1>
            <p className="mt-2 text-sm text-zinc-9000">No sets found for this year.</p>
          </div>

          <Link href="/years" className="text-sm font-semibold hover:underline">
            ← All years
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold">
          <Link href="/themes" className="text-zinc-900 hover:text-amber-600 hover:underline">
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
        <Link href="/themes" className="text-zinc-900 hover:text-amber-600 hover:underline">
          Browse themes →
        </Link>

        {topThemes.map((t) => (
          <Link key={t} href={`/themes/${themeToSlug(t)}`} className="text-zinc-900 hover:text-amber-600 hover:underline">
            {t} →
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{y}</h1>
          <div className="mt-2 text-sm text-zinc-9000">
            Page {page}
            {totalPages ? <span className="ml-1">of {totalPages}</span> : null}
            {typeof totalCount === "number" ? <span className="ml-2">• {totalCount} sets</span> : null}
          </div>
        </div>

        <Link href="/years" className="text-sm font-semibold text-zinc-900 hover:text-amber-600 hover:underline">
          ← All years
        </Link>
      </div>

      <ThemesClient sets={rows} />

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={firstHref}
            aria-disabled={page <= 1}
            className={`rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 ${
              page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-zinc-100"
            }`}
          >
            « First
          </Link>

          <Link
            href={qsBase(y, Math.max(1, page - 1))}
            aria-disabled={!hasPrev}
            className={`rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 ${
              !hasPrev ? "pointer-events-none opacity-50" : "hover:bg-zinc-100"
            }`}
          >
            ← Prev
          </Link>

          <Link
            href={qsBase(y, page + 1)}
            aria-disabled={!hasNext}
            className={`rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 ${
              !hasNext ? "pointer-events-none opacity-50" : "hover:bg-zinc-100"
            }`}
          >
            Next →
          </Link>

          <Link
            href={lastHref}
            aria-disabled={totalPages != null ? page >= totalPages : !hasNext}
            className={`rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 ${
              totalPages != null
                ? page >= totalPages
                  ? "pointer-events-none opacity-50"
                  : "hover:bg-zinc-100"
                : !hasNext
                  ? "pointer-events-none opacity-50"
                  : "hover:bg-zinc-100"
            }`}
          >
            Last »
          </Link>
        </div>

        {pageList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {pageList.map((p, idx) =>
              p === "..." ? (
                <span key={`dots-${idx}`} className="px-2 text-sm text-zinc-9000">
                  …
                </span>
              ) : (
                <Link
                  key={p}
                  href={qsBase(y, p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`h-9 min-w-9 rounded-full border px-3 text-sm font-semibold ${
                    p === page
                      ? "border-amber-500/40 bg-amber-500 text-black"
                      : "border-zinc-200 text-zinc-900 hover:bg-zinc-100"
                  }`}
                >
                  {p}
                </Link>
              )
            )}
          </div>
        ) : (
          <div className="text-sm text-zinc-9000">{hasNext ? "More pages available" : "No more pages"}</div>
        )}
      </div>
    </div>
  );
}