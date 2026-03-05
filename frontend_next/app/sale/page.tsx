// frontend_next/app/sale/page.tsx
import type { Metadata } from "next";
import SaleClient from "./SaleClient";
import AnalyticsClient from "@/app/components/AnalyticsClient";
import { apiBase } from "@/lib/api";
import { siteBase, SITE_NAME } from "@/lib/url";
import { isRecord, type UnknownRecord, type SetLite } from "@/lib/types";
import { unwrapSearchParams, first, type SP } from "@/lib/searchParams";

export const revalidate = 3600; // ISR

type FeedResponse =
  | SetLite[]
  | {
      results?: unknown;
      total?: unknown;
      total_pages?: unknown;
      page?: unknown;
    };

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}): Promise<Metadata> {
  const sp = await unwrapSearchParams(searchParams);
  const page = toInt(first(sp, "page") || "1", 1);

  const title = "Deals & price drops";
  const description = "Browse LEGO sets on sale and track price drops across popular retailers.";
  const canonicalPath = "/sale";

  const robots = page > 1 ? ({ index: false, follow: true } as const) : undefined;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    robots,
    openGraph: { title, description, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function isSetLite(x: unknown): x is SetLite {
  return isRecord(x) && typeof x.set_num === "string" && x.set_num.trim().length > 0;
}

function toSetLiteArray(x: unknown): SetLite[] {
  return Array.isArray(x) ? x.filter(isSetLite) : [];
}

function asFeedResponse(x: unknown): FeedResponse {
  if (Array.isArray(x)) return toSetLiteArray(x);
  if (isRecord(x)) {
    return { results: x.results, total: x.total, total_pages: x.total_pages, page: x.page };
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

  const url = `${apiBase()}/sets?${params.toString()}`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  if (!res.ok) return [];

  const raw: unknown = await res.json().catch(() => null);
  const data = asFeedResponse(raw);

  return Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: unknown }).results)
      ? toSetLiteArray((data as { results?: unknown }).results)
      : [];
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
      <AnalyticsClient title="Deals & price drops" />

      <section className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">Deals &amp; price drops</h1>
        <p className="mt-2 max-w-[540px] text-sm text-zinc-500">
          Browse LEGO sets we’re tracking for discounts and price drops.
        </p>

        {error ? <p className="mt-4 text-sm text-red-600">Error: {error}</p> : null}
        {!error && sets.length === 0 ? <p className="mt-4 text-sm text-zinc-500">No sets found yet.</p> : null}
        {!error && sets.length > 0 ? <SaleClient sets={sets} /> : null}
      </section>
    </div>
  );
}