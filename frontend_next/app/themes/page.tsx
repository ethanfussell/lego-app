// frontend_next/app/themes/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { themeToSlug } from "@/lib/slug";
import { siteBase, SITE_NAME } from "@/lib/url";
import { first, type SP } from "@/lib/searchParams";

export const revalidate = 3600;

type JsonLdObject = Record<string, unknown>;
type ThemeRow = { theme: string; set_count: number };

const DEFAULT_LIMIT = 60;

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

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function totalPagesFrom(totalCount: number | null, limit: number) {
  if (totalCount == null || totalCount < 0) return null;
  return Math.max(1, Math.ceil(totalCount / Math.max(1, limit)));
}

/**
 * Build a compact pager like:
 * 1 … 6 7 [8] 9 10 … 42
 */
function buildPageList(current: number, totalPages: number) {
  const out: Array<number | "..."> = [];
  const add = (x: number | "...") => {
    if (out.length === 0 || out[out.length - 1] !== x) out.push(x);
  };

  const window = 2;
  const start = Math.max(2, current - window);
  const end = Math.min(totalPages - 1, current + window);

  add(1);
  if (start > 2) add("...");
  for (let p = start; p <= end; p++) add(p);
  if (end < totalPages - 1) add("...");
  if (totalPages > 1) add(totalPages);

  return out;
}

async function fetchThemes(q: string, page: number, limit: number): Promise<{ rows: ThemeRow[]; totalCount: number | null }> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  params.set("limit", String(limit));

  // Server Component -> hit backend directly so we can read headers reliably
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const url = `${apiBase}/themes?${params.toString()}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return { rows: [], totalCount: null };

  const data: unknown = await res.json();
  const rows = Array.isArray(data) ? (data as ThemeRow[]) : [];

  const header = res.headers.get("x-total-count") || res.headers.get("X-Total-Count");
  const parsed = header ? Number(header) : NaN;
  const totalCount = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

  return { rows, totalCount };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}): Promise<Metadata> {
  const sp = (await searchParams) ?? ({} as SP);
  const page = toInt(first(sp, "page") || "1", 1);

  const title = "Browse LEGO themes";
  const description = "Browse LEGO themes and find sets by theme.";
  const canonicalPath = "/themes";

  // paginated pages should be noindex (avoid duplicates)
  const robots = page > 1 ? ({ index: false, follow: true } as const) : undefined;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    robots,
    openGraph: {
      title: `Browse LEGO themes | ${SITE_NAME}`,
      description,
      url: canonicalPath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `Browse LEGO themes | ${SITE_NAME}`,
      description,
    },
  };
}

export default async function ThemesIndexPage({ searchParams }: { searchParams?: SP | Promise<SP> }) {
  const sp = (await searchParams) ?? ({} as SP);

  const q = first(sp, "q");
  const page = toInt(first(sp, "page") || "1", 1);
  const limit = DEFAULT_LIMIT;

  const qsBase = (p: number) =>
    `/themes?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    }).toString()}`;

  const { rows, totalCount } = await fetchThemes(q, page, limit);
  const totalPages = totalPagesFrom(totalCount, limit);

  // ✅ Option A: clamp to last page (redirect to canonical valid page)
  if (totalPages != null && page > totalPages) {
    redirect(qsBase(totalPages));
  }

  const hasPrev = page > 1;
  const hasNext = totalPages != null ? page < totalPages : rows.length === limit;

  const pageList = totalPages && totalPages > 1 ? buildPageList(page, totalPages) : [];

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Themes", href: "/themes" },
  ];
  const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbItems, siteBase());

  return (
    <div className="mx-auto max-w-4xl p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Themes" }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Themes</h1>
          <p className="mt-2 text-zinc-500">Pick a theme to browse sets.</p>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/years" className="text-sm font-semibold text-zinc-900 hover:text-amber-600 hover:underline">
            Browse by year →
          </Link>

          <Link href="/" className="text-sm font-semibold text-zinc-900 hover:text-amber-600 hover:underline">
            ← Home
          </Link>
        </div>
      </div>

      <form className="mt-6 flex gap-2" action="/themes">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search themes…"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
        <button className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100">
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No themes found.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const href = `/themes/${themeToSlug(r.theme)}`;
            return (
              <Link
                key={r.theme}
                href={href}
                className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:bg-zinc-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">{r.theme}</div>
                  <div className="text-xs font-semibold text-zinc-500">{r.set_count} sets</div>
                </div>
                <div className="mt-1 text-sm text-zinc-500">View sets →</div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-10 flex flex-col items-center gap-3">
        {pageList.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <Link
              href={qsBase(Math.max(1, page - 1))}
              aria-disabled={!hasPrev}
              aria-label="Previous page"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-colors ${
                !hasPrev
                  ? "pointer-events-none border-zinc-100 text-zinc-300"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              ‹
            </Link>

            {pageList.map((p, idx) =>
              p === "..." ? (
                <span key={`dots-${idx}`} className="px-1 text-sm text-zinc-400 select-none">
                  …
                </span>
              ) : (
                <Link
                  key={p}
                  href={qsBase(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-medium transition-colors ${
                    p === page
                      ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                      : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  {p}
                </Link>
              )
            )}

            <Link
              href={qsBase(page + 1)}
              aria-disabled={!hasNext}
              aria-label="Next page"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-colors ${
                !hasNext
                  ? "pointer-events-none border-zinc-100 text-zinc-300"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              ›
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href={qsBase(Math.max(1, page - 1))}
              aria-disabled={!hasPrev}
              className={`inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors ${
                !hasPrev
                  ? "pointer-events-none border-zinc-100 text-zinc-300"
                  : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              ← Prev
            </Link>
            <Link
              href={qsBase(page + 1)}
              aria-disabled={!hasNext}
              className={`inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors ${
                !hasNext
                  ? "pointer-events-none border-zinc-100 text-zinc-300"
                  : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              Next →
            </Link>
          </div>
        )}

        <p className="text-xs text-zinc-400">
          Page {page}
          {totalPages ? <> of {totalPages}</> : null}
          {typeof totalCount === "number" ? <> &middot; {totalCount} themes</> : null}
        </p>
      </div>
    </div>
  );
}