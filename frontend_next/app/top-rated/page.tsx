import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { apiBase } from "@/lib/api";
import { siteBase } from "@/lib/url";
import { asFiniteNumber, asTrimmedString, isRecord, pickRows } from "@/lib/types";
import { safeImageSrc } from "@/lib/image";

export const revalidate = 3600;

type SetRow = {
  set_num: string;
  name: string;
  pieces?: number | null;
  year?: number | null;
  theme?: string | null;
  image_url?: string | null;
  avg_rating?: number | null;
  review_count?: number | null;
};

function coerceSetRow(x: unknown): SetRow | null {
  if (!isRecord(x)) return null;
  const set_num = asTrimmedString(x.set_num ?? x.setNum ?? x.set_number);
  const name = asTrimmedString(x.name);
  if (!set_num || !name) return null;

  return {
    set_num,
    name,
    pieces: asFiniteNumber(x.pieces ?? x.num_parts) ?? null,
    year: asFiniteNumber(x.year) ?? null,
    theme: asTrimmedString(x.theme) ?? null,
    image_url: asTrimmedString(x.image_url) ?? null,
    avg_rating: asFiniteNumber(x.rating_avg ?? x.avg_rating) ?? null,
    review_count: asFiniteNumber(x.review_count ?? x.rating_count) ?? null,
  };
}

async function fetchTopRatedSets(): Promise<{ sets: SetRow[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("page", "1");
  qs.set("limit", "60");
  qs.set("min_rating", "4");
  qs.set("sort", "rating");
  qs.set("order", "desc");

  let res: Response;
  try {
    res = await fetch(`${apiBase()}/sets?${qs}`, {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
  } catch {
    return { sets: [], total: 0 };
  }

  if (!res.ok) return { sets: [], total: 0 };

  const total = asFiniteNumber(res.headers.get("x-total-count")) ?? 0;
  const data: unknown = await res.json().catch(() => null);
  const sets = pickRows(data).map(coerceSetRow).filter((r): r is SetRow => !!r);
  return { sets, total };
}

const TITLE = "Top Rated LEGO Sets";
const DESCRIPTION = "Browse the highest rated LEGO sets, ranked by community reviews.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/top-rated" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/top-rated", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {"★".repeat(full)}
      {half && "½"}
      <span className="ml-1 text-xs font-medium text-zinc-700">{rating.toFixed(1)}</span>
    </span>
  );
}

export default async function Page() {
  const { sets, total } = await fetchTopRatedSets();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="text-sm text-zinc-500">
          <Link href="/" className="font-semibold hover:underline">Home</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href="/discover" className="font-semibold hover:underline">Discover</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-zinc-900">Top Rated</span>
        </div>

        <div className="mt-3">
          <h1 className="m-0 text-2xl font-semibold">{TITLE}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {total > 0 ? `${total.toLocaleString()} sets rated 4+ stars` : DESCRIPTION}
          </p>
        </div>
      </div>

      {sets.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No rated sets found yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => {
            const imgSrc = safeImageSrc(s.image_url);
            return (
              <div key={s.set_num} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300">
                <div className="flex gap-3">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    {imgSrc ? (
                      <div className="relative h-20 w-24">
                        <Image src={imgSrc} alt={s.name || s.set_num} fill sizes="96px" className="object-contain p-2" />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">No image</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/sets/${encodeURIComponent(s.set_num)}`} className="block truncate text-sm font-semibold hover:underline">
                      {s.name}
                    </Link>
                    {typeof s.avg_rating === "number" && s.avg_rating > 0 && (
                      <div className="mt-1">
                        <StarRating rating={s.avg_rating} />
                        {typeof s.review_count === "number" && s.review_count > 0 && (
                          <span className="ml-1 text-[11px] text-zinc-400">({s.review_count})</span>
                        )}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-zinc-500">
                      <span className="font-semibold">{s.set_num}</span>
                      {typeof s.pieces === "number" && (
                        <><span className="mx-1">&bull;</span><span>{s.pieces.toLocaleString()} pcs</span></>
                      )}
                      {typeof s.year === "number" && (
                        <><span className="mx-1">&bull;</span><span>{s.year}</span></>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10">
        <Link href="/discover" className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100">
          &larr; Discover
        </Link>
      </div>
    </div>
  );
}
