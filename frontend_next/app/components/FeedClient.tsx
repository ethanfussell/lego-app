// frontend_next/app/components/FeedClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import SetCard from "@/app/components/SetCard";
import { apiFetch } from "@/lib/api";

type QueryParams = {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  order?: string;
};

export default function FeedClient({
  title,
  description,
  queryParams = {},
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
  variant = "default",
}: {
  title: string;
  description?: string;
  queryParams?: QueryParams;
  ownedSetNums?: Set<string>;
  wishlistSetNums?: Set<string>;
  onMarkOwned?: (setNum: string) => void;
  onAddWishlist?: (setNum: string) => void;
  variant?: string;
}) {
  const [sets, setSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const qpKey = useMemo(() => JSON.stringify(queryParams || {}), [queryParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadSets() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        params.set("page", String(queryParams.page ?? 1));
        params.set("limit", String(queryParams.limit ?? 50));
        if (queryParams.q) params.set("q", queryParams.q);
        if (queryParams.sort) params.set("sort", queryParams.sort);
        if (queryParams.order) params.set("order", queryParams.order);

        const data = await apiFetch<any>(`/sets?${params.toString()}`, { cache: "no-store" });
        const items = Array.isArray(data) ? data : data?.results || [];

        if (!cancelled) setSets(items);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSets();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qpKey]);

  const hasResults = sets.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16">
      <h1 className="mt-10 text-2xl font-semibold">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-sm text-zinc-500">{description}</p> : null}

      {loading ? <p className="mt-6 text-sm">Loading sets…</p> : null}
      {error ? <p className="mt-6 text-sm text-red-600">Error: {error}</p> : null}

      {!loading && !error && !hasResults ? <p className="mt-6 text-sm text-zinc-500">No sets found for this feed.</p> : null}

      {!loading && !error && hasResults ? (
        <ul className="mt-6 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-4 gap-y-7 p-0">
          {sets.map((set) => (
            <li key={set.set_num} className="w-full max-w-[260px]">
              <SetCard
                set={set}
                isOwned={ownedSetNums?.has(set.set_num)}
                isInWishlist={wishlistSetNums?.has(set.set_num)}
                onMarkOwned={onMarkOwned}
                onAddWishlist={onAddWishlist}
                // If your SetCard TS props don’t include `variant`, either:
                // (1) add it to SetCard props, or
                // (2) delete this line.
                variant={variant as any}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}