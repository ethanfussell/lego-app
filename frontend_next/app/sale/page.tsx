// frontend_next/app/sale/page.tsx
import type { Metadata } from "next";
import SaleClient from "./SaleClient";
import AnalyticsClient from "@/app/components/AnalyticsClient";

export const revalidate = 3600; // ISR

type SP = Record<string, string | string[] | undefined>;

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

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function isPromiseLike<T>(v: unknown): v is PromiseLike<T> {
  return typeof v === "object" && v !== null && "then" in v && typeof (v as any).then === "function";
}

async function unwrapSearchParams<T extends object>(p?: T | Promise<T>): Promise<T> {
  if (!p) return {} as T;
  return isPromiseLike<T>(p) ? await p : p;
}

function first(sp: SP, key: string): string {
  const raw = sp[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v ?? "").trim();
}

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
    return { results: o.results, total: o.total, total_pages: o.total_pages, page: o.page };
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