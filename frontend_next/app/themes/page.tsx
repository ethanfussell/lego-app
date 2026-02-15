// frontend_next/app/themes/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Breadcrumbs from "@/app/components/Breadcrumbs";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export const metadata: Metadata = {
  title: "Themes",
  description: `Browse LEGO themes on ${SITE_NAME}.`,
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/themes" },
  openGraph: {
    title: `Themes | ${SITE_NAME}`,
    description: `Browse LEGO themes on ${SITE_NAME}.`,
    url: "/themes",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Themes | ${SITE_NAME}`,
    description: `Browse LEGO themes on ${SITE_NAME}.`,
  },
};

type ThemeRow = { theme: string; set_count: number };
type SP = Record<string, string | string[] | undefined>;

const DEFAULT_LIMIT = 60;

function first(sp: SP, key: string): string {
  const raw = sp[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v ?? "").trim();
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

async function fetchThemes(
  q: string,
  page: number,
  limit: number
): Promise<{ rows: ThemeRow[]; totalCount: number | null }> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  params.set("limit", String(limit));

  // Server Component -> hit backend directly so we can read headers reliably
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const url = `${apiBase}/themes?${params.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { rows: [], totalCount: null };

  const data: unknown = await res.json();
  const rows = Array.isArray(data) ? (data as ThemeRow[]) : [];

  const header = res.headers.get("x-total-count") || res.headers.get("X-Total-Count");
  const parsed = header ? Number(header) : NaN;
  const totalCount = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

  return { rows, totalCount };
}

export default async function ThemesIndexPage({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}) {
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

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Themes" }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Themes</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Pick a theme to browse sets.</p>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/years"
            className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            Browse by year →
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            ← Home
          </Link>
        </div>
      </div>

      <form className="mt-6 flex gap-2" action="/themes">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search themes…"
          className="w-full rounded-xl border border-black/[.08] bg-white px-4 py-2 text-sm dark:border-white/[.145] dark:bg-black"
        />
        <button className="rounded-xl border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-white/[.145] dark:bg-black dark:hover:bg-zinc-900">
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">No themes found.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const href = `/themes/${encodeURIComponent(r.theme)}`;
            return (
              <Link
                key={r.theme}
                href={href}
                className="rounded-xl border border-black/[.08] bg-white p-4 hover:bg-zinc-50 dark:border-white/[.145] dark:bg-black dark:hover:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">{r.theme}</div>
                  <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    {r.set_count} sets
                  </div>
                </div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">View sets →</div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={qsBase(Math.max(1, page - 1))}
            aria-disabled={!hasPrev}
            className={`rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold dark:border-white/[.145] dark:bg-black ${
              !hasPrev ? "pointer-events-none opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            ← Prev
          </Link>

          <Link
            href={qsBase(page + 1)}
            aria-disabled={!hasNext}
            className={`rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold dark:border-white/[.145] dark:bg-black ${
              !hasNext ? "pointer-events-none opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            Next →
          </Link>
        </div>

        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Page {page}
          {totalPages ? <span className="ml-1">of {totalPages}</span> : null}
          {typeof totalCount === "number" ? <span className="ml-2">• {totalCount} themes</span> : null}
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
                  href={qsBase(p)}
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
        ) : null}
      </div>
    </div>
  );
}