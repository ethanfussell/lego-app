// frontend_next/app/sale/page.tsx
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import SaleClient from "./SaleClient";
import AnalyticsClient from "@/app/components/AnalyticsClient";

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string;
  image_url?: string | null;
  average_rating?: number | null;
  rating_avg?: number | null;
  rating_count?: number;
};

type FeedResponse =
  | SetLite[]
  | {
      results?: unknown;
      total?: unknown;
      total_pages?: unknown;
      page?: unknown;
    };

export const metadata: Metadata = {
  title: "Deals & price drops",
};

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function isSetLite(x: unknown): x is SetLite {
  return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
}

function toSetLiteArray(x: unknown): SetLite[] {
  return Array.isArray(x) ? x.filter(isSetLite) : [];
}

function asFeedResponse(x: unknown): FeedResponse {
  if (Array.isArray(x)) return toSetLiteArray(x);

  if (typeof x === "object" && x !== null) {
    const o = x as { results?: unknown; total?: unknown; total_pages?: unknown; page?: unknown };
    return {
      results: o.results,
      total: o.total,
      total_pages: o.total_pages,
      page: o.page,
    };
  }

  return [];
}

async function fetchSaleSets(): Promise<SetLite[]> {
  const params = new URLSearchParams();
  params.set("q", "lego");
  params.set("sort", "rating");
  params.set("order", "desc");
  params.set("page", "1");
  params.set("limit", "60");

  const raw = await apiFetch<unknown>(`/sets?${params.toString()}`, { cache: "no-store" });
  const data = asFeedResponse(raw);

  const items: SetLite[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: unknown }).results)
      ? toSetLiteArray((data as { results?: unknown }).results)
      : [];

  return items.filter((s) => s.set_num.trim() !== "");
}

export default async function Page() {
  let sets: SetLite[] = [];
  let error: string | null = null;

  try {
    sets = await fetchSaleSets();
  } catch (e: unknown) {
    error = errorMessage(e);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* ✅ ensures GA page_view has a title immediately */}
      <AnalyticsClient title="Deals & price drops" />

      <section className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">Deals &amp; price drops</h1>
        <p className="mt-2 max-w-[540px] text-sm text-zinc-500">
          Browse highly-rated LEGO sets that we’ll eventually sort by discounts and price drops from different shops.
        </p>

        {error ? <p className="mt-4 text-sm text-red-600">Error: {error}</p> : null}

        {!error && sets.length === 0 ? <p className="mt-4 text-sm text-zinc-500">No sets found for this category yet.</p> : null}

        {!error && sets.length > 0 ? <SaleClient sets={sets} /> : null}
      </section>
    </div>
  );
}