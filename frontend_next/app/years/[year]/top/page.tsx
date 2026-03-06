// frontend_next/app/years/[year]/top/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { themeToSlug } from "@/lib/slug";
import { apiBase } from "@/lib/api";
import { siteBase } from "@/lib/url";
import { getFiniteNumber as getNumber, getTrimmedString as getString, isRecord, pickRows, type UnknownRecord } from "@/lib/types";

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

type Params = { year: string };

function normalizeYear(raw: string): number | null {
  const s = decodeURIComponent(String(raw || "")).trim();
  if (!/^\d{4}$/.test(s)) return null;

  const y = Number(s);
  if (!Number.isFinite(y)) return null;

  const max = new Date().getFullYear();
  if (y < 1980 || y > max) return null;

  return y;
}

function canonicalForYearTop(year: number) {
  return `/years/${year}/top`;
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

function getNullableString(o: UnknownRecord, key: string): string | null {
  const v = o[key];
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function coerceSetRow(x: unknown): SetRow | null {
  if (!isRecord(x)) return null;

  const set_num = getString(x, "set_num") ?? getString(x, "setNum") ?? getString(x, "set_number");
  const name = getString(x, "name");
  if (!set_num || !name) return null;

  const year = getNumber(x, "year") ?? undefined;
  const pieces = getNumber(x, "pieces") ?? getNumber(x, "num_parts") ?? undefined;

  const theme = getNullableString(x, "theme");
  const image_url = getString(x, "image_url");

  const average_rating =
    getNumber(x, "average_rating") ??
    getNumber(x, "rating_avg") ??
    null;

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

async function fetchTopSetsForYearSSR(year: number): Promise<SetRow[] | "notfound"> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("sort", "rating");
  qs.set("order", "desc");
  qs.set("page", "1");
  qs.set("limit", "36");

  const url = `${apiBase()}/sets?${qs.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  } catch {
    return [];
  }

  if (res.status === 404) return "notfound";
  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  const rows = pickRows(data);

  return rows.map(coerceSetRow).filter((r): r is SetRow => !!r);
}

function RelatedLinks({ year }: { year: number }) {
  const otherYears = RECENT_YEARS.filter((y) => y !== year);

  return (
    <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">Related pages</h2>

      <div className="mt-3 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="text-sm font-semibold text-zinc-900">More years</div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600">
            {otherYears.map((y) => (
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

        <div>
          <div className="text-sm font-semibold text-zinc-900">Top themes</div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600">
            {TOP_THEMES.map((t) => {
              const slug = themeToSlug(t);
              return (
                <li key={slug}>
                  <Link href={`/themes/${slug}/top`} className="hover:underline">
                    Top sets in {t}
                  </Link>
                </li>
              );
            })}
            <li className="pt-1">
              <Link href="/themes" className="font-semibold hover:underline">
                Browse all themes →
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const { year } = await Promise.resolve(params);
  const y = normalizeYear(year);

  if (!y) {
    return {
      title: "Top LEGO sets by year",
      description: "Browse the highest-rated LEGO sets by year.",
      metadataBase: new URL(siteBase()),
      robots: { index: false, follow: false },
    };
  }

  const canonical = canonicalForYearTop(y);
  const title = `Top LEGO sets of ${y}`;
  const description = `Browse the highest-rated LEGO sets from ${y}.`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page({ params }: { params: Params | Promise<Params> }) {
  const { year } = await Promise.resolve(params);
  const y = normalizeYear(year);
  if (!y) notFound();

  const sets = await fetchTopSetsForYearSSR(y);
  if (sets === "notfound") notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="text-sm text-zinc-9000">
          <Link href="/" className="font-semibold hover:underline">
            Home
          </Link>
          <span className="mx-2">›</span>
          <Link href="/years" className="font-semibold hover:underline">
            Years
          </Link>
          <span className="mx-2">›</span>
          <Link href={`/years/${y}`} className="font-semibold hover:underline">
            {y}
          </Link>
          <span className="mx-2">›</span>
          <span className="text-zinc-900">Top sets</span>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold">Top sets of {y}</h1>
            <p className="mt-2 text-sm text-zinc-9000">
              Highest-rated sets from {y} (sorted by average rating, then rating count).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/years/${y}`}
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              ← Year {y}
            </Link>
            <Link
              href="/years"
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              Browse years →
            </Link>
          </div>
        </div>
      </div>

      {sets.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-9000">
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
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300"
              >
                <div className="flex gap-3">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
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

                    <div className="mt-1 text-xs text-zinc-9000">
                      <span className="font-semibold">{s.set_num}</span>
                      {typeof s.pieces === "number" ? (
                        <>
                          <span className="mx-1">•</span>
                          <span>{s.pieces.toLocaleString()} pcs</span>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-1 text-xs text-zinc-9000">
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
                        <span className="text-zinc-9000">No ratings yet</span>
                      )}
                    </div>

                    {s.theme ? (
                      <div className="mt-1 text-xs text-zinc-9000">
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

      <RelatedLinks year={y} />
    </div>
  );
}