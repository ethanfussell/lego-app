"use client";

import Link from "next/link";

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  image_url?: string | null;
  rating_count?: number | null;
};

export default function ThemesClient({
  theme,
  sets,
  page,
  limit,
  sort,
}: {
  theme: string;
  sets: SetSummary[];
  page: number;
  limit: number;
  sort: string;
}) {
  const prevHref =
    page > 1 ? `/themes/${encodeURIComponent(theme)}?page=${page - 1}&limit=${limit}&sort=${encodeURIComponent(sort)}` : null;

  // If API returns fewer than limit, we assume “no next page”
  const hasNext = sets.length === limit;
  const nextHref = hasNext
    ? `/themes/${encodeURIComponent(theme)}?page=${page + 1}&limit=${limit}&sort=${encodeURIComponent(sort)}`
    : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{theme}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Page {page} · Sort: {sort}
          </p>
        </div>

        <Link
          href="/themes"
          className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
        >
          ← All themes
        </Link>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sets.map((s) => (
          <li
            key={s.set_num}
            className="rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm dark:border-white/[.12] dark:bg-zinc-950"
          >
            <Link href={`/sets/${encodeURIComponent(s.set_num)}`} className="hover:underline">
              <div className="text-base font-semibold">{s.name}</div>
            </Link>

            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div>{s.set_num}</div>
              {typeof s.year === "number" ? <div>Year: {s.year}</div> : null}
              {typeof s.pieces === "number" ? <div>Pieces: {s.pieces}</div> : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex items-center justify-between">
        <div>
          {prevHref ? (
            <Link
              href={prevHref}
              className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-zinc-50 dark:border-white/[.2] dark:hover:bg-zinc-900"
            >
              ← Prev
            </Link>
          ) : (
            <span />
          )}
        </div>

        <div>
          {nextHref ? (
            <Link
              href={nextHref}
              className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-zinc-50 dark:border-white/[.2] dark:hover:bg-zinc-900"
            >
              Next →
            </Link>
          ) : (
            <span className="text-sm text-zinc-500">No more pages</span>
          )}
        </div>
      </div>
    </div>
  );
}