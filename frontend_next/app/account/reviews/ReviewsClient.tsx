// frontend_next/app/account/reviews/ReviewsClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import RequireAuth from "@/app/components/RequireAuth";

type ReviewRow = {
  id?: number | string;

  set_num?: string;
  setNum?: string;

  set_name?: string;
  setName?: string;

  rating?: number | null;
  text?: string | null;

  created_at?: string;
  createdAt?: string;

  // optional enrichment
  image_url?: string | null;
  imageUrl?: string | null;
  theme?: string | null;
  year?: number | null;
  pieces?: number | null;
};

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string;
  image_url?: string | null;
};

function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof Error ? e.message : String(e ?? fallback);
}

function fmtDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function normalizeReview(r: ReviewRow) {
  const set_num = r.set_num ?? r.setNum ?? "";
  const set_name = r.set_name ?? r.setName ?? "";
  const created_at = r.created_at ?? r.createdAt ?? "";
  return { ...r, set_num, set_name, created_at };
}

/**
 * apiFetch sometimes returns:
 *   - an array
 *   - { results: [...] }
 *   - something else
 */
function coerceArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "results" in value) {
    const results = (value as { results?: unknown }).results;
    return Array.isArray(results) ? (results as T[]) : [];
  }
  return [];
}

function isSetLite(x: unknown): x is SetLite {
  if (!x || typeof x !== "object") return false;
  const v = x as Record<string, unknown>;
  return typeof v.set_num === "string" && v.set_num.trim().length > 0;
}

function pill(active: boolean) {
  return [
    "rounded-full px-3 py-1.5 text-sm font-semibold border",
    active
      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white"
      : "bg-white text-zinc-900 border-black/[.10] hover:bg-black/[.04] dark:bg-transparent dark:text-zinc-50 dark:border-white/[.14] dark:hover:bg-white/[.06]",
  ].join(" ");
}

async function fetchMyReviews(token: string): Promise<ReviewRow[]> {
  const qs = new URLSearchParams();
  qs.set("limit", "200");

  // backend mounted under /sets
  const url = qs.toString() ? `/sets/reviews/me?${qs.toString()}` : "/sets/reviews/me";
  const rowsUnknown: unknown = await apiFetch(url, { token, cache: "no-store" });

  const arr = coerceArray<ReviewRow>(rowsUnknown);
  return arr.map(normalizeReview);
}

async function enrichWithSets(token: string, reviews: ReviewRow[]): Promise<ReviewRow[]> {
  const missing = reviews
    .filter((r) => !(r.image_url || r.imageUrl))
    .map((r) => String(r.set_num ?? "").trim())
    .filter(Boolean);

  const unique = Array.from(new Set(missing));
  if (!unique.length) return reviews;

  const joined = encodeURIComponent(unique.join(","));
  const setsUnknown: unknown = await apiFetch(`/sets/bulk?set_nums=${joined}`, { token, cache: "no-store" });

  const setArr = coerceArray<unknown>(setsUnknown).filter(isSetLite);
  const byNum = new Map(setArr.map((s) => [String(s.set_num), s]));

  return reviews.map((r) => {
    const s = byNum.get(String(r.set_num || ""));
    return {
      ...r,
      image_url: r.image_url || r.imageUrl || s?.image_url || null,
      set_name: r.set_name || s?.name || r.set_num,
      theme: r.theme ?? (s?.theme ?? null),
      year: r.year ?? (typeof s?.year === "number" ? s.year : null),
      pieces: r.pieces ?? (typeof s?.pieces === "number" ? s.pieces : null),
    };
  });
}

export default function ReviewsClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const filter = sp.get("filter"); // "rated" | "unrated" | null

  const { token, hydrated } = useAuth();

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hydrated) return;
      if (!token) return;

      try {
        setLoading(true);
        setErr(null);

        const base = await fetchMyReviews(token);
        const enriched = await enrichWithSets(token, base);

        if (cancelled) return;
        setRows(enriched);
      } catch (e: unknown) {
        if (cancelled) return;
        setErr(errorMessage(e, "Failed to load reviews"));
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, hydrated]);

  const filtered = useMemo(() => {
    if (!filter) return rows;

    if (filter === "rated") {
      return rows.filter((r) => typeof r.rating === "number");
    }
    if (filter === "unrated") {
      return rows.filter((r) => !(typeof r.rating === "number"));
    }
    return rows;
  }, [rows, filter]);

  return (
    <RequireAuth>
      <div className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold">My reviews</h1>
            <p className="mt-2 text-sm text-zinc-500">
              {loading ? "Loading…" : `${filtered.length.toLocaleString()} review${filtered.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/account")}
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              ← Back to account
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link href="/account/reviews" className={pill(!filter)}>
            All
          </Link>
          <Link href="/account/reviews?filter=rated" className={pill(filter === "rated")}>
            Rated
          </Link>
          <Link href="/account/reviews?filter=unrated" className={pill(filter === "unrated")}>
            Unrated
          </Link>
        </div>

        {err ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
            <div className="font-semibold">Couldn’t load your reviews</div>
            <div className="mt-2 whitespace-pre-wrap">{err}</div>
            <div className="mt-3 text-zinc-600 dark:text-zinc-300">
              If your backend endpoint isn’t <code>/sets/reviews/me</code>, paste the error and we’ll swap it.
            </div>
          </div>
        ) : null}

        {!err && !loading && filtered.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">No reviews yet.</p>
        ) : null}

        {!err && filtered.length > 0 ? (
          <ul className="mt-6 grid gap-3">
            {filtered.map((r) => {
              const setNum = String(r.set_num || "").trim();
              const title = (r.set_name || setNum || "Set").trim();
              const when = fmtDate(r.created_at);

              const imageUrl = r.image_url || r.imageUrl || null;
              const rating = typeof r.rating === "number" ? r.rating : null;
              const text = String(r.text || "").trim();

              return (
                <li
                  key={String(r.id ?? `${setNum}-${r.created_at ?? ""}-${title}`)}
                  className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.14] dark:bg-zinc-950"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={setNum ? `/sets/${encodeURIComponent(setNum)}` : "/"}
                        className="block font-extrabold text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {title}
                      </Link>

                      <div className="mt-1 text-sm text-zinc-500">
                        {setNum ? <span>{setNum}</span> : null}
                        {when ? <span>{setNum ? " • " : ""}{when}</span> : null}
                        {r.theme ? <span>{" • "}{r.theme}</span> : null}
                        {typeof r.pieces === "number" ? <span>{" • "}{r.pieces.toLocaleString()} pcs</span> : null}
                        {typeof r.year === "number" ? <span>{" • "}{r.year}</span> : null}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-extrabold text-zinc-900 dark:text-zinc-50">
                        {rating == null ? "—" : rating.toFixed(1)}{" "}
                        <span className="text-sm">★</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-3">
                    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/[.08] bg-white dark:border-white/[.14] dark:bg-zinc-950">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <div className="text-xs font-bold text-zinc-400">—</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {text ? (
                        <p className="m-0 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{text}</p>
                      ) : (
                        <p className="m-0 text-sm text-zinc-400">No review text</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </RequireAuth>
  );
}