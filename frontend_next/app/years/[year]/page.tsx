// frontend_next/app/years/[year]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import ThemesClient from "@/app/themes/ThemesClient";
import Breadcrumbs from "@/app/components/Breadcrumbs";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

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

function qsBase(year: number, p: number) {
  const qs = new URLSearchParams(p > 1 ? { page: String(p) } : {}).toString();
  return qs ? `/years/${year}?${qs}` : `/years/${year}`;
}

function topThemesFromRows(rows: SetSummary[], max = 3) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const r of rows) {
    const t = String((r as any)?.theme ?? "").trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }

  return out;
}

async function fetchSetsByYear(year: number, page: number, limit: number) {
  const params = new URLSearchParams();
  params.set("year", String(year));
  if (page > 1) params.set("page", String(page));
  params.set("limit", String(limit));

  const url = new URL(`/api/sets?${params.toString()}`, siteBase()).toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { rows: [] as SetSummary[], totalCount: null as number | null };

  const data: unknown = await res.json();

  const rows = Array.isArray(data)
    ? (data as SetSummary[])
    : typeof data === "object" && data !== null && Array.isArray((data as any).results)
      ? ((data as any).results as SetSummary[])
      : [];

  const header = res.headers.get("x-total-count") || res.headers.get("X-Total-Count");
  const parsed = header ? Number(header) : NaN;
  const totalCount = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

  return { rows, totalCount };
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
  const y = toInt(String(year), NaN as any);

  const rawPage = Math.max(1, toInt(first(sp, "page") || "1", 1));
  const page = rawPage; // metadata can’t know totalPages without fetching; keep it as requested

  const baseTitle = Number.isFinite(y) ? `Sets from ${y}` : "Sets by year";

  const validYear = Number.isFinite(y) && y >= min && y <= max;
  const title = validYear ? (page > 1 ? `${baseTitle} (Page ${page})` : baseTitle) : "Sets by year";

  const canonical = validYear ? qsBase(y, page) : "/years";

  const description = validYear
    ? page > 1
      ? `Browse LEGO sets released in ${y}. Page ${page}.`
      : `Browse LEGO sets released in ${y}.`
    : `Browse LEGO sets by release year on ${SITE_NAME}.`;

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
  const y = toInt(String(year), NaN as any);

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

  // Fetch once using requestedPage
  const firstPass = await fetchSetsByYear(y, requestedPage, limit);
  const totalPages =
    firstPass.totalCount != null ? Math.max(1, Math.ceil(firstPass.totalCount / limit)) : null;

  // Clamp to last page if user asks for something too big (only if we know totalPages)
  const page = totalPages != null ? Math.min(requestedPage, totalPages) : requestedPage;

  // If we had to clamp, refetch for the real page (so results match the UI)
  const { rows, totalCount } = page === requestedPage ? firstPass : await fetchSetsByYear(y, page, limit);

  const hasPrev = page > 1;
  const hasNext = totalPages != null ? page < totalPages : rows.length === limit;

  const pageList = totalPages && totalPages > 1 ? buildPageList(page, totalPages) : [];

  const firstHref = qsBase(y, 1);
  const lastHref = totalPages ? qsBase(y, totalPages) : qsBase(y, page);

  // Internal links (Task 8)
  const topThemes = topThemesFromRows(rows, 3);

  // No results
  if (page === 1 && rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Years", href: "/years" },
            { label: String(y) },
          ]}
        />

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

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Years", href: "/years" },
          { label: String(y) },
        ]}
      />

      {/* Task 8: internal links */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold">
        <Link href="/themes" className="text-zinc-900 hover:underline dark:text-zinc-50">
          Browse themes →
        </Link>

        {topThemes.map((t) => (
          <Link
            key={t}
            href={`/themes/${encodeURIComponent(t)}`}
            className="text-zinc-900 hover:underline dark:text-zinc-50"
          >
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

      {/* Pagination */}
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* First */}
          <Link
            href={firstHref}
            aria-disabled={page <= 1}
            className={`rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold dark:border-white/[.145] dark:bg-black ${
              page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            « First
          </Link>

          {/* Prev */}
          <Link
            href={qsBase(y, Math.max(1, page - 1))}
            aria-disabled={!hasPrev}
            className={`rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold dark:border-white/[.145] dark:bg-black ${
              !hasPrev ? "pointer-events-none opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            ← Prev
          </Link>

          {/* Next */}
          <Link
            href={qsBase(y, page + 1)}
            aria-disabled={!hasNext}
            className={`rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold dark:border-white/[.145] dark:bg-black ${
              !hasNext ? "pointer-events-none opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            Next →
          </Link>

          {/* Last */}
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