// frontend_next/app/retiring-soon/page.tsx
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import RetiringSoonClient from "./RetiringSoonClient";

export const dynamic = "force-static";
export const revalidate = 3600;

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

  const title = "Retiring soon";
  const description = "LEGO sets expected to retire soon—browse and add your favorites before they’re gone.";
  const canonicalPath = "/retiring-soon";

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
  return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
}

function toSetLiteArray(x: unknown): SetLite[] {
  return Array.isArray(x) ? x.filter(isSetLite) : [];
}

function asFeedResponse(x: unknown): FeedResponse {
  if (Array.isArray(x)) return toSetLiteArray(x);
  if (typeof x === "object" && x !== null) {
    const o = x as { results?: unknown };
    return { results: o.results };
  }
  return [];
}

async function fetchRetiringSoonSets(): Promise<SetLite[]> {
  const params = new URLSearchParams();
  params.set("q", "retiring");
  params.set("sort", "rating");
  params.set("order", "desc");
  params.set("page", "1");
  params.set("limit", "60");

  // Keep your existing behavior: always fresh data from API layer
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
    sets = await fetchRetiringSoonSets();
  } catch (e: unknown) {
    error = errorMessage(e);
  }

  return <RetiringSoonClient initialSets={sets} initialError={error} />;
}