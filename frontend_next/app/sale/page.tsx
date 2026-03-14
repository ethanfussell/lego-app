// frontend_next/app/sale/page.tsx
import type { Metadata } from "next";
import SaleClient from "./SaleClient";
import AnalyticsClient from "@/app/components/AnalyticsClient";
import { apiBase } from "@/lib/api";
import { siteBase, SITE_NAME } from "@/lib/url";
import { isRecord, type SetLite } from "@/lib/types";
import { unwrapSearchParams, first, type SP } from "@/lib/searchParams";

export const revalidate = 900; // 15 min ISR

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
  const description =
    "Find the best LEGO deals — sets on sale below retail price across popular retailers.";
  const canonicalPath = "/sale";

  const robots =
    page > 1 ? ({ index: false, follow: true } as const) : undefined;

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

type DealsResponse = {
  results: SetLite[];
  total: number;
  total_pages: number;
  page: number;
  themes: string[];
};

function isSetLite(x: unknown): x is SetLite {
  return isRecord(x) && typeof x.set_num === "string" && x.set_num.trim().length > 0;
}

async function fetchDeals(): Promise<DealsResponse> {
  const url = `${apiBase()}/sets/deals?limit=60&sort=discount&order=desc`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  if (!res.ok) {
    return { results: [], total: 0, total_pages: 0, page: 1, themes: [] };
  }

  const raw: unknown = await res.json().catch(() => null);
  if (!isRecord(raw)) {
    return { results: [], total: 0, total_pages: 0, page: 1, themes: [] };
  }

  const results = Array.isArray(raw.results)
    ? (raw.results as unknown[]).filter(isSetLite)
    : [];
  const themes = Array.isArray(raw.themes)
    ? (raw.themes as unknown[]).filter((t): t is string => typeof t === "string")
    : [];

  return {
    results,
    total: typeof raw.total === "number" ? raw.total : results.length,
    total_pages: typeof raw.total_pages === "number" ? raw.total_pages : 1,
    page: typeof raw.page === "number" ? raw.page : 1,
    themes,
  };
}

export default async function Page() {
  let data: DealsResponse = {
    results: [],
    total: 0,
    total_pages: 0,
    page: 1,
    themes: [],
  };
  let error: string | null = null;

  try {
    data = await fetchDeals();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AnalyticsClient title="Deals & price drops" />

      <section className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">Deals &amp; price drops</h1>
        <p className="mt-2 max-w-[540px] text-sm text-zinc-500">
          LEGO sets currently on sale below retail price. Updated regularly across major retailers.
        </p>

        {error ? (
          <p className="mt-4 text-sm text-red-600">Error: {error}</p>
        ) : null}
        {!error && data.results.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
            <p className="text-sm font-medium text-zinc-700">No deals right now</p>
            <p className="mt-1 text-xs text-zinc-500">
              We&apos;re tracking prices across retailers. Check back soon for discounts!
            </p>
          </div>
        ) : null}
        {!error && data.results.length > 0 ? (
          <SaleClient
            initialSets={data.results}
            totalDeals={data.total}
            themes={data.themes}
          />
        ) : null}
      </section>
    </div>
  );
}
