// frontend_next/app/components/FeedClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import SetCard from "@/app/components/SetCard";
import { apiFetch } from "@/lib/api";
import AddToListMenu from "@/app/components/AddToListMenu";
import { useAuth } from "@/app/providers";

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
}: {
  title: string;
  description?: string;
  queryParams?: QueryParams;
  ownedSetNums?: Set<string>;
  wishlistSetNums?: Set<string>;
}) {
  const { token } = useAuth();

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

      {!loading && !error && !hasResults ? (
        <p className="mt-6 text-sm text-zinc-500">No sets found for this feed.</p>
      ) : null}

      {!loading && !error && hasResults ? (
        <ul className="mt-6 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-4 gap-y-7 p-0">
          {sets.map((set) => {
            const setNum = String(set?.set_num || "").trim();
            const owned = !!ownedSetNums?.has(setNum);
            const wished = !!wishlistSetNums?.has(setNum);

            return (
              <li key={setNum || Math.random()} className="w-full max-w-[260px]">
                <SetCard
                  set={set}
                  variant={owned ? "owned" : wished ? "wishlist" : "feed"}
                  footer={
                    token && setNum ? (
                      <div className="flex items-center justify-center">
                        <AddToListMenu token={token} setNum={setNum} />
                      </div>
                    ) : null
                  }
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}