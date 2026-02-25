// frontend_next/app/new/page.tsx
import type { Metadata } from "next";
import NewSetsClient from "./NewSetsClient";

export const revalidate = 3600; // ISR (1 hour)

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

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase() {
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

  const title = "New LEGO sets";
  const description = "Browse newly released LEGO sets and see what’s trending right now.";
  const canonicalPath = "/new";

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

function normalizeSets(x: unknown): SetLite[] {
  if (Array.isArray(x)) return toSetLiteArray(x);
  if (typeof x === "object" && x !== null) {
    const r = (x as { results?: unknown }).results;
    return Array.isArray(r) ? toSetLiteArray(r) : [];
  }
  return [];
}

async function fetchNewSets(): Promise<SetLite[]> {
  const params = new URLSearchParams();
  params.set("q", "lego");
  params.set("sort", "year");
  params.set("order", "desc");
  params.set("page", "1");
  params.set("limit", "80");

  const url = `${apiBase()}/sets?${params.toString()}`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  return normalizeSets(data);
}

export default async function Page() {
  let sets: SetLite[] = [];
  let error: string | null = null;

  try {
    sets = await fetchNewSets();
  } catch (e: unknown) {
    error = errorMessage(e);
  }

  return <NewSetsClient initialSets={sets} initialError={error} />;
}