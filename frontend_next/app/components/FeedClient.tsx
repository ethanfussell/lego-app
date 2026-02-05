// frontend_next/app/components/FeedClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";

type QueryParams = {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  order?: string;
};

type FeedClientProps = {
  title: string;
  description?: string;
  queryParams?: QueryParams;
  ownedSetNums?: Set<string>;
  wishlistSetNums?: Set<string>;
};

type SetLite = {
  set_num?: string;
  [k: string]: unknown;
};

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function FeedClient({
  title,
  description,
  queryParams,
  ownedSetNums,
  wishlistSetNums,
}: FeedClientProps) {
  const { token } = useAuth();

  const qp = useMemo<QueryParams>(() => queryParams ?? {}, [queryParams]);
  const qpKey = useMemo(() => JSON.stringify(qp), [qp]);

  const [sets, setSets] = useState<SetLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSets() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        params.set("page", String(qp.page ?? 1));
        params.set("limit", String(qp.limit ?? 50));
        if (qp.q) params.set("q", qp.q);
        if (qp.sort) params.set("sort", qp.sort);
        if (qp.order) params.set("order", qp.order);

        const data = await apiFetch<unknown>(`/sets?${params.toString()}`, { cache: "no-store" });
        const items = Array.isArray(data)
          ? (data as SetLite[])
          : Array.isArray((data as { results?: unknown })?.results)
          ? ((data as { results: SetLite[] }).results as SetLite[])
          : [];

        if (!cancelled) setSets(items);
      } catch (e: unknown) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSets();
    return () => {
      cancelled = true;
    };
  }, [qpKey, qp]);

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
          {sets.map((s) => {
            const sn = String(s?.set_num || "").trim();
            if (!sn) return null;

            // if you want the props to *count as used*, actually use them:
            const owned = ownedSetNums?.has(sn);
            const wished = wishlistSetNums?.has(sn);

            return (
              <li key={sn} className="w-full max-w-[260px]">
                <SetCard
                  set={s}
                  footer={
                    token ? (
                      <div className="space-y-2">
                        {(owned || wished) ? (
                          <div className="text-xs font-semibold text-zinc-500">
                            {owned ? "In Owned" : null}
                            {owned && wished ? " · " : null}
                            {wished ? "In Wishlist" : null}
                          </div>
                        ) : null}
                        <SetCardActions token={token} setNum={sn} />
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