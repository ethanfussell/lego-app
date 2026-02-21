// frontend_next/app/sale/page.tsx
import type { Metadata } from "next";
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
  alternates: { canonical: "/sale" },
};

export const revalidate = 3600; // ✅ ISR

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function isSetLite(x: unknown): x is SetLite {
  if (typeof x !== "object" || x === null) return false;
  const sn = (x as { set_num?: unknown }).set_num;
  return typeof sn === "string" && sn.trim().length > 0;
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

  // ✅ Server Component: hit backend directly and allow ISR caching
  const url = `${apiBase()}/sets?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    next: { revalidate }, // ✅ cacheable
  });

  if (!res.ok) return [];

  const raw: unknown = await res.json().catch(() => null);
  const data = asFeedResponse(raw);

  const items: SetLite[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: unknown }).results)
      ? toSetLiteArray((data as { results?: unknown }).results)
      : [];

  return items;
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

        {!error && sets.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No sets found for this category yet.</p>
        ) : null}

        {!error && sets.length > 0 ? <SaleClient sets={sets} /> : null}
      </section>
    </div>
  );
}