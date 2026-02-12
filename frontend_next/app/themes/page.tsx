// frontend_next/app/themes/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

const SITE_NAME = "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
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

type ThemeRow = { theme: string; sets_count: number };
type SP = Record<string, string | string[] | undefined>;

function first(sp: SP, key: string): string {
  const raw = sp[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v ?? "").trim();
}
function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

async function fetchThemes(q: string, page: number): Promise<ThemeRow[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("limit", "60");

  const url = `${apiBase()}/themes?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as ThemeRow[]) : [];
}

export default async function ThemesIndexPage({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}) {
  const sp = (await searchParams) ?? ({} as SP);
  const q = first(sp, "q");
  const page = toInt(first(sp, "page") || "1", 1);

  const rows = await fetchThemes(q, page);

  const qsBase = (p: number) =>
    `/themes?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    }).toString()}`;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-bold">Themes</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Pick a theme to browse sets.</p>

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
                    {r.sets_count} sets
                  </div>
                </div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">View sets →</div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <Link
          href={qsBase(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={`rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold dark:border-white/[.145] dark:bg-black ${
            page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
          }`}
        >
          Prev
        </Link>

        <div className="text-sm text-zinc-600 dark:text-zinc-400">Page {page}</div>

        <Link
          href={qsBase(page + 1)}
          className="rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-white/[.145] dark:bg-black dark:hover:bg-zinc-900"
        >
          Next
        </Link>
      </div>
    </div>
  );
}