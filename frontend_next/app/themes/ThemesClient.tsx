// frontend_next/app/themes/ThemesClient.tsx
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  image_url?: string | null;
  rating_count?: number | null;
};

type SetCardSetProp = React.ComponentProps<typeof SetCard>["set"];

function toSetCardSet(s: SetSummary): SetCardSetProp {
  // Build a minimal object that satisfies SetCard's `set` prop shape
  // without using `any`.
  return {
    set_num: s.set_num,
    name: s.name,
    year: s.year,
    pieces: s.pieces ?? null,
    image_url: s.image_url ?? null,
    rating_count: s.rating_count ?? null,
  } as unknown as SetCardSetProp;
}

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
  const { token } = useAuth();

  const prevHref =
    page > 1
      ? `/themes/${encodeURIComponent(theme)}?page=${page - 1}&limit=${limit}&sort=${encodeURIComponent(sort)}`
      : null;

  const hasNext = sets.length === limit;
  const nextHref = hasNext
    ? `/themes/${encodeURIComponent(theme)}?page=${page + 1}&limit=${limit}&sort=${encodeURIComponent(sort)}`
    : null;

  const cardSets = useMemo(() => sets.map(toSetCardSet), [sets]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{theme}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Page {page} · Sort: {sort}
          </p>
        </div>

        <Link href="/themes" className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
          ← All themes
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cardSets.map((setForCard, idx) => {
          const original = sets[idx];
          return (
            <div key={original.set_num} className="h-full">
              <SetCard
                set={setForCard}
                footer={<SetCardActions token={token ?? null} setNum={original.set_num} />}
              />
            </div>
          );
        })}
      </div>

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