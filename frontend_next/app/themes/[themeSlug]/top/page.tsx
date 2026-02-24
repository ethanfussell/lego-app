// frontend_next/app/themes/[themeSlug]/top/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { slugToTheme, themeToSlug } from "@/lib/slug";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = true;
export const fetchCache = "force-cache";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

type Params = { themeSlug: string };

function canonicalForThemeTop(themeSlug: string) {
  return `/themes/${themeSlug}/top`;
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceSetRow(x: unknown): SetRow | null {
  if (!isRecord(x)) return null;

  const set_num = typeof x.set_num === "string" ? x.set_num.trim() : "";
  const name = typeof x.name === "string" ? x.name.trim() : "";
  if (!set_num || !name) return null;

  const year = typeof x.year === "number" && Number.isFinite(x.year) ? x.year : undefined;
  const pieces = typeof x.pieces === "number" && Number.isFinite(x.pieces) ? x.pieces : undefined;
  const theme = typeof x.theme === "string" ? x.theme : x.theme == null ? null : String(x.theme);
  const image_url = typeof x.image_url === "string" ? x.image_url : null;

  const average_rating =
    typeof (x as any).average_rating === "number" && Number.isFinite((x as any).average_rating)
      ? (x as any).average_rating
      : typeof (x as any).rating_avg === "number" && Number.isFinite((x as any).rating_avg)
        ? (x as any).rating_avg
        : null;

  const rating_count =
    typeof (x as any).rating_count === "number" && Number.isFinite((x as any).rating_count)
      ? Math.max(0, Math.floor((x as any).rating_count))
      : null;

  return {
    set_num,
    name,
    ...(typeof year === "number" ? { year } : {}),
    ...(typeof pieces === "number" ? { pieces } : {}),
    theme: theme?.trim() ? theme.trim() : null,
    image_url,
    average_rating,
    rating_count,
  };
}

async function fetchTopSetsForThemeSSR(themeName: string): Promise<SetRow[] | "notfound"> {
  const qs = new URLSearchParams();
  qs.set("q", themeName); // matches_query checks `q in theme`
  qs.set("sort", "rating");
  qs.set("order", "desc");
  qs.set("page", "1");
  qs.set("limit", "36");

  const url = `${apiBase()}/sets?${qs.toString()}`;

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
  const rows = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray((data as any).results)
      ? (data as any).results
      : [];

  if (!Array.isArray(rows)) return [];
  return rows.map(coerceSetRow).filter((r): r is SetRow => !!r);
}

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const { themeSlug } = await Promise.resolve(params);
  const themeName = slugToTheme(themeSlug);

  // If slugToTheme can’t resolve, you can choose to noindex.
  if (!themeName || !themeName.trim()) {
    return {
      title: `Top LEGO sets by theme | ${SITE_NAME}`,
      description: `Browse the highest-rated LEGO sets by theme.`,
      metadataBase: new URL(siteBase()),
      robots: { index: false, follow: false },
    };
  }

  const canonical = canonicalForThemeTop(themeSlug);
  const title = `Top LEGO sets in ${themeName}`;
  const description = `Browse the highest-rated LEGO sets in the ${themeName} theme.`;

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: canonical, type: "website" },
    twitter: { card: "summary", title: `${title} | ${SITE_NAME}`, description },
  };
}

export default async function Page({ params }: { params: Params | Promise<Params> }) {
  const { themeSlug } = await Promise.resolve(params);
  const themeName = slugToTheme(themeSlug);
  if (!themeName || !themeName.trim()) notFound();

  const sets = await fetchTopSetsForThemeSSR(themeName);
  if (sets === "notfound") notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        {/* breadcrumbs */}
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/" className="font-semibold hover:underline">
            Home
          </Link>
          <span className="mx-2">›</span>
          <Link href="/themes" className="font-semibold hover:underline">
            Themes
          </Link>
          <span className="mx-2">›</span>
          <Link href={`/themes/${encodeURIComponent(themeSlug)}`} className="font-semibold hover:underline">
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/themes/${encodeURIComponent(themeSlug)}`}
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              ← Theme
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

            return (
              <div
                key={s.set_num}
                className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950"
              >
                <div className="flex gap-3">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-50 dark:bg-white/5">
                    {s.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image_url}
                        alt={s.name || s.set_num}
                        className="h-full w-full object-contain p-2"
                        loading="lazy"
                      />
                    ) : null}
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
    </div>
  );
}