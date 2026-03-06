// frontend_next/app/pieces/under/[max]/best/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { themeToSlug } from "@/lib/slug";

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

type Params = { max: string };

function normalizeMax(raw: string): number | null {
  const s = decodeURIComponent(String(raw || "")).trim();
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 20000) return null;
  return Math.floor(n);
}

function canonicalFor(max: number) {
  return `/pieces/under/${max}/best`;
}

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

async function fetchTopSetsUnder(maxPieces: number): Promise<SetRow[]> {
  const qs = new URLSearchParams();
  qs.set("max_pieces", String(maxPieces));
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

  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  const rows = pickRows(data);

  // defensive: keep only those actually under the limit
  return rows
    .map(coerceSetRow)
    .filter((r): r is SetRow => !!r)
    .filter((r) => typeof r.pieces !== "number" || r.pieces <= maxPieces);
}

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const { max } = await Promise.resolve(params);
  const n = normalizeMax(max);

  const base = new URL(siteBase());

  if (!n) {
    return {
      title: "Best LEGO sets under N pieces",
      description: "Browse the best LEGO sets under a piece count.",
      metadataBase: base,
      robots: { index: false, follow: false },
    };
  }

  const canonicalPath = canonicalFor(n);
  const canonicalUrl = new URL(canonicalPath, base).toString();

  const title = `Best LEGO sets under ${n.toLocaleString()} pieces (top-rated)`;
  const description = `Browse top-rated LEGO sets with ${n.toLocaleString()} pieces or fewer, ranked by average rating and rating count.`;

  const ogImageUrl = new URL("/opengraph-image", base).toString();

  return {
    title,
    description,
    metadataBase: base,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
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
  const { max } = await Promise.resolve(params);
  const n = normalizeMax(max);
  if (!n) notFound();

  const sets = await fetchTopSetsUnder(n);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="text-sm text-zinc-9000">
          <Link href="/" className="font-semibold hover:underline">
            Home
          </Link>
          <span className="mx-2">›</span>
          <span className="text-zinc-900">Pieces</span>
          <span className="mx-2">›</span>
          <span className="text-zinc-900">Under {n.toLocaleString()}</span>
          <span className="mx-2">›</span>
          <span className="text-zinc-900">Best</span>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold">Best sets under {n.toLocaleString()} pieces</h1>
            <p className="mt-2 text-sm text-zinc-9000">
              Top-rated sets with {n.toLocaleString()} pieces or fewer (sorted by average rating, then rating count).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/years"
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              Browse years →
            </Link>
            <Link
              href="/themes"
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              Browse themes →
            </Link>
          </div>
        </div>
      </div>

      {sets.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-9000">
          No results yet (needs ratings) — add a few ratings/reviews and this page will populate.
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
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300"
              >
                <div className="flex gap-3">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    {imgSrc ? (
                      <div className="relative h-20 w-24">
                        <Image src={imgSrc} alt={s.name || s.set_num} fill sizes="96px" className="object-contain p-2" />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-9000">
                        No image
                      </div>
                    )}
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
                      {typeof s.year === "number" ? (
                        <>
                          <span className="mx-1">•</span>
                          <Link href={`/years/${s.year}`} className="font-semibold hover:underline">
                            {s.year}
                          </Link>
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
    </div>
  );
}