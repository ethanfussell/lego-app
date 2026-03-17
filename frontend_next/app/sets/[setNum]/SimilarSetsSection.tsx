// frontend_next/app/sets/[setNum]/SimilarSetsSection.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, APIError } from "@/lib/api";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import SetCard, { type SetLite } from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { SetGridSkeleton } from "@/app/components/Skeletons";
import ErrorState from "@/app/components/ErrorState";
import { themeToSlug } from "@/lib/slug";

const PREVIEW_SIMILAR_LIMIT = 12;

function isSetLite(x: unknown): x is SetLite {
  if (typeof x !== "object" || x === null) return false;
  const sn = (x as { set_num?: unknown }).set_num;
  return typeof sn === "string" && sn.trim() !== "";
}

function normalizeSetLiteArray(data: unknown): SetLite[] {
  if (Array.isArray(data)) return data.filter(isSetLite);
  if (typeof data === "object" && data !== null) {
    const results = (data as { results?: unknown }).results;
    return Array.isArray(results) ? results.filter(isSetLite) : [];
  }
  return [];
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type Props = {
  theme: string;
  setNum: string;
  token: string | null;
};

export default function SimilarSetsSection({ theme, setNum, token }: Props) {
  const { isOwned, isWishlist, getUserRating } = useCollectionStatus();
  const [similarSets, setSimilarSets] = useState<SetLite[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const similarRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const themeName = typeof theme === "string" ? theme.trim() : "";

    if (!themeName) {
      setSimilarSets([]);
      setSimilarError(null);
      setSimilarLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchSimilar() {
      try {
        setSimilarLoading(true);
        setSimilarError(null);

        const p = new URLSearchParams();
        p.set("page", "1");
        p.set("limit", "24");
        p.set("sort", "relevance");
        p.set("order", "desc");

        const path = `/themes/${encodeURIComponent(themeName)}/sets?${p.toString()}`;

        const data = await apiFetch<unknown>(path, { cache: "no-store" });
        const items = normalizeSetLiteArray(data);
        const filtered = items.filter((s) => String(s?.set_num) !== String(setNum));

        if (!cancelled) setSimilarSets(filtered.slice(0, PREVIEW_SIMILAR_LIMIT));
      } catch (e: unknown) {
        if (e instanceof APIError && e.status === 404) {
          if (!cancelled) {
            setSimilarSets([]);
            setSimilarError(null);
          }
          return;
        }
        if (!cancelled) setSimilarError(errorMessage(e));
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    }

    void fetchSimilar();
    return () => {
      cancelled = true;
    };
  }, [theme, setNum]);

  function scrollSimilar(direction: number) {
    const node = similarRowRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * 240, behavior: "smooth" });
  }

  if (!similarLoading && !similarError && similarSets.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">More from {theme}</h2>

        {theme ? (
          <Link
            href={`/themes/${themeToSlug(String(theme))}`}
            prefetch={false}
            className="text-sm font-semibold text-amber-600 hover:text-amber-500 transition-colors"
          >
            Browse all &rarr;
          </Link>
        ) : null}
      </div>

      {similarLoading ? <div className="mt-4"><SetGridSkeleton count={4} /></div> : null}
      {similarError ? <ErrorState message={similarError} /> : null}

      {!similarLoading && !similarError && similarSets.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No other sets found for this theme yet.</p>
      ) : null}

      {!similarLoading && !similarError && similarSets.length > 0 ? (
        <div className="relative mt-4">
          <div ref={similarRowRef} className="overflow-x-auto pb-2 scrollbar-thin">
            <ul className="m-0 flex list-none gap-3 p-0">
              {similarSets.map((s) => (
                <li key={s.set_num} className="w-[220px] shrink-0">
                  <SetCard set={s} token={token ?? undefined} isOwnedByUser={isOwned(s.set_num)} userRatingOverride={getUserRating(s.set_num)} footer={<SetCardActions token={token ?? null} setNum={s.set_num} isOwned={isOwned(s.set_num)} isWishlist={isWishlist(s.set_num)} />} />
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => scrollSimilar(-1)}
            aria-label="Scroll left"
            className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-zinc-50/90 p-1.5 text-zinc-500 shadow-sm backdrop-blur hover:bg-zinc-100 hover:text-zinc-700 sm:block transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => scrollSimilar(1)}
            aria-label="Scroll right"
            className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-zinc-50/90 p-1.5 text-zinc-500 shadow-sm backdrop-blur hover:bg-zinc-100 hover:text-zinc-700 sm:block transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      ) : null}
    </section>
  );
}
