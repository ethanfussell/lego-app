// frontend_next/app/new/page.tsx
import type { Metadata } from "next";
import NewSetsClient from "./NewSetsClient";

export const metadata: Metadata = {
  title: "New sets",
};

export const revalidate = 3600; // ✅ ISR (1 hour)

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

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
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
  params.set("order", "desc"); // newest first
  params.set("page", "1");
  params.set("limit", "80");

  const url = `${apiBase()}/sets?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    next: { revalidate }, // ✅ cacheable fetch
  });

  if (!res.ok) return [];

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    return [];
  }

  return normalizeSets(data);
}

export default async function Page() {
  let sets: SetLite[] = [];
  let error: string | null = null;

  try {
    sets = await fetchNewSets();
  } catch (e: unknown) {
    // Degraded-but-200 response (don’t throw -> avoids caching 500s)
    error = errorMessage(e);
  }

  return <NewSetsClient initialSets={sets} initialError={error} />;
}