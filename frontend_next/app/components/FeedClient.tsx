// frontend_next/app/components/FeedClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import SetCard, { type SetLite } from "@/app/components/SetCard";
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

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeSetLite(v: unknown): SetLite | null {
  if (!isRecord(v)) return null;

  const set_num = String(v.set_num ?? "").trim();
  if (!set_num) return null; // required by SetCard's SetLite

  const name = typeof v.name === "string" ? v.name : "";
  const year = typeof v.year === "number" ? v.year : undefined;

  // some APIs use pieces / num_parts
  const piecesRaw = typeof v.pieces === "number" ? v.pieces : typeof v.num_parts === "number" ? v.num_parts : undefined;
  const pieces = typeof piecesRaw === "number" ? piecesRaw : undefined;

  const image_url =
    typeof v.image_url === "string"
      ? v.image_url
      : typeof v.imageUrl === "string"
      ? v.imageUrl
      : null;

  const rating_count =
    typeof v.rating_count === "number"
      ? v.rating_count
      : typeof v.ratingCount === "number"
      ? v.ratingCount
      : null;

  const theme = typeof v.theme === "string" ? v.theme : undefined;

  // Build a SetLite-shaped object; extra fields are fine but not required.
  const out: SetLite = {
    set_num,
    name,
    year,
    pieces,
    image_url,
    rating_count,
    theme,
  } as SetLite;

  return out;
}

function extractResults(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.results)) return data.results;
  return [];
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
        const rawItems = extractResults(data);

        const normalized: SetLite[] = [];
        for (const item of rawItems) {
          const s = normalizeSetLite(item);
          if (s) normalized.push(s);
        }

        if (!cancelled) setSets(normalized);
      } catch (e: unknown) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSets();
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
            const sn = s.set_num; // guaranteed string

            const owned = ownedSetNums?.has(sn) ?? false;
            const wished = wishlistSetNums?.has(sn) ?? false;

            return (
              <li key={sn} className="w-full max-w-[260px]">
                <SetCard
                  set={s}
                  footer={
                    token ? (
                      <div className="space-y-2">
                        {owned || wished ? (
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