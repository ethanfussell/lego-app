// frontend_next/app/themes/[themeSlug]/top/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { slugToTheme, themeToSlug } from "@/lib/slug";

export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = true;
export const fetchCache = "force-cache";

// Keep these in sync with sitemap.xml/route.ts
const RECENT_YEARS = [2026, 2025, 2024, 2023, 2022] as const;
const TOP_THEMES = [
  "Star Wars",
  "Duplo",
  "City",
  "Town",
  "Friends",
  "Educational and Dacta",
  "Creator",
  "Technic",
  "Ninjago",
  "Seasonal",
] as const;

const TOP_THEME_SET = new Set<string>(TOP_THEMES);

const DEFAULT_LIMIT = 36;

function siteBase() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}
function apiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
}

type Params = { themeSlug: string };

type UnknownRecord = Record<string, unknown>;
function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getString(o: UnknownRecord, key: string): string | null {
  const v = o[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function getNumber(o: UnknownRecord, key: string): number | null {
  const v = o[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

type SetRow = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  theme?: string | null;
  image_url?: string | null;
  average_rating?: number | null;
  rating_count?: number | null;
};

function coerceSetRow(x: unknown): SetRow | null {
  if (!isRecord(x)) return null;

  const set_num = getString(x, "set_num") ?? getString(x, "setNum") ?? getString(x, "set_number");
  const name = getString(x, "name");
  if (!set_num || !name) return null;

  const year = getNumber(x, "year") ?? undefined;
  const pieces = getNumber(x, "pieces") ?? getNumber(x, "num_parts") ?? undefined;

  const themeRaw = getString(x, "theme");
  const theme = themeRaw ? themeRaw : null;

  const image_url = getString(x, "image_url");

  const average_rating = getNumber(x, "average_rating") ?? getNumber(x, "rating_avg") ?? null;

  const rating_count = (() => {
    const rc = getNumber(x, "rating_count");
    return rc != null ? Math.max(0, Math.floor(rc)) : null;
  })();

  return {
    set_num,
    name,
    ...(typeof year === "number" ? { year } : {}),
    ...(typeof pieces === "number" ? { pieces } : {}),
    theme,
    image_url: image_url ?? null,
    average_rating,
    rating_count,
  };
}

function pickRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.results)) return data.results as unknown[];
  return [];
}

async function fetchTopSetsForThemeSSR(themeName: string): Promise<SetRow[] | "notfound"> {
  const qs = new URLSearchParams();
  qs.set("page", "1");
  qs.set("limit", String(DEFAULT_LIMIT));
  qs.set("sort", "rating");
  qs.set("order", "desc");

  // IMPORTANT: encode the THEME NAME for the API path (not the slug)
  const url = `${apiBase()}/themes/${encodeURIComponent(themeName)}/sets?${qs.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
  } catch {
    return [];
  }

  if (res.status === 404) return "notfound";
  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  const rows = pickRows(data);
  return rows.map(coerceSetRow).filter((r): r is SetRow => !!r);
}

function RelatedLinks({ themeName }: { themeName: string }) {
  const currentSlug = themeToSlug(themeName);
  const otherThemeSlugs = TOP_THEMES.map((t) => themeToSlug(t)).filter((s) => s !== currentSlug);

  return (
    <div className="mt-10 rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
      <h2 className="text-base font-semibold">Related pages</h2>

      <div className="mt-3 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Top themes</div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            {otherThemeSlugs.map((slug) => (
              <li key={slug}>
                <Link href={`/themes/${slug}/top`} className="hover:underline">
                  Top sets in {slugToTheme(slug) || slug.replaceAll("-", " ")}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              <Link href="/themes/top" className="font-semibold hover:underline">
                View Top Themes hub →
              </Link>
            </li>
            <li className="pt-1">
              <Link href="/themes" className="font-semibold hover:underline">
                Browse all themes →
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recent years</div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            {RECENT_YEARS.map((y) => (
              <li key={y}>
                <Link href={`/years/${y}/top`} className="hover:underline">
                  Top sets of {y}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              <Link href="/years" className="font-semibold hover:underline">
                Browse all years →
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// NOTE: themeSlug passed here must already be URL-safe (encoded) => do NOT encodeURIComponent again.
function canonicalForThemeTop(themeSlug: string) {
  return `/themes/${themeSlug}/top`;
}

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const { themeSlug } = await Promise.resolve(params);

  const themeName = slugToTheme(themeSlug);
  const base = new URL(siteBase());

  if (!themeName || !themeName.trim()) {
    return {
      title: "Top LEGO sets by theme",
      description: "Browse the highest-rated LEGO sets by theme.",
      metadataBase: base,
      robots: { index: false, follow: false },
    };
  }

  const canonicalSlug = themeToSlug(themeName);
  const canonicalPath = canonicalForThemeTop(canonicalSlug);

  const title = `Top LEGO sets in ${themeName} (highest-rated)`;
  const description = `Browse the highest-rated LEGO sets in the ${themeName} theme, ranked by average rating and rating count.`;

  const ogImageUrl = new URL("/opengraph-image", base).toString();

  // ✅ Option A:
  // - Only curated TOP_THEMES pages are indexable
  // - All other /themes/{slug}/top pages are noindex,follow
  const isCuratedTop = TOP_THEME_SET.has(themeName);

  return {
    title,
    description,
    metadataBase: base,
    alternates: { canonical: canonicalPath }, // keep canonical stable
    robots: isCuratedTop ? undefined : ({ index: false, follow: true } as const),
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      siteName: "LEGO App",
      images: [{ url: ogImageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function Page({ params }: { params: Params | Promise<Params> }) {
  const { themeSlug } = await Promise.resolve(params);

  const themeName = slugToTheme(themeSlug);
  if (!themeName || !themeName.trim()) notFound();

  const canonicalSlug = themeToSlug(themeName);

  const sets = await fetchTopSetsForThemeSSR(themeName);
  if (sets === "notfound") notFound();

  const isCuratedTop = TOP_THEME_SET.has(themeName);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/" className="font-semibold hover:underline">
            Home
          </Link>
          <span className="mx-2">›</span>
          <Link href="/themes" className="font-semibold hover:underline">
            Themes
          </Link>
          <span className="mx-2">›</span>
          <Link href={`/themes/${canonicalSlug}`} className="font-semibold hover:underline">
            {themeName}
          </Link>
          <span className="mx-2">›</span>
          <span className="text-zinc-900 dark:text-zinc-50">Top sets</span>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold">Top sets in {themeName}</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Highest-rated sets in this theme (sorted by average rating, then rating count).
            </p>

            {!isCuratedTop ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Note: this page is not part of our curated Top Themes set.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/themes/${canonicalSlug}`}
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              ← Theme
            </Link>
            <Link
              href="/themes/top"
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Top themes →
            </Link>
            <Link
              href="/themes"
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Browse themes →
            </Link>
          </div>
        </div>
      </div>

      {sets.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          No results yet (needs ratings). Add a few reviews/ratings and this page will populate.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => {
            const rating = typeof s.average_rating === "number" ? s.average_rating.toFixed(1) : null;
            const rcount = typeof s.rating_count === "number" ? s.rating_count : null;
            const imgSrc = typeof s.image_url === "string" && s.image_url.trim() ? s.image_url.trim() : null;

            return (
              <div
                key={s.set_num}
                className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950"
              >
                <div className="flex gap-3">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-50 dark:bg-white/5">
                    {imgSrc ? (
                      <div className="relative h-20 w-24">
                        <Image src={imgSrc} alt={s.name || s.set_num} fill sizes="96px" className="object-contain p-2" />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">No image</div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/sets/${encodeURIComponent(s.set_num)}`}
                      className="block truncate text-sm font-semibold hover:underline"
                    >
                      {s.name}
                    </Link>

                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="font-semibold">{s.set_num}</span>
                      {typeof s.pieces === "number" ? (
                        <>
                          <span className="mx-1">•</span>
                          <span>{s.pieces.toLocaleString()} pcs</span>
                        </>
                      ) : null}
                      {typeof s.year === "number" ? (
                        <>
                          <span className="mx-1">•</span>
                          <Link href={`/years/${s.year}`} className="font-semibold hover:underline">
                            {s.year}
                          </Link>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {rating ? (
                        <>
                          ⭐ <span className="font-semibold">{rating}</span>
                          {rcount != null ? (
                            <>
                              <span className="mx-1">•</span>
                              <span>
                                {rcount.toLocaleString()} rating{rcount === 1 ? "" : "s"}
                              </span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-zinc-500">No ratings yet</span>
                      )}
                    </div>

                    {s.theme ? (
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        Theme:{" "}
                        <Link href={`/themes/${themeToSlug(String(s.theme))}`} className="font-semibold hover:underline">
                          {s.theme}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RelatedLinks themeName={themeName} />
    </div>
  );
}