// frontend_next/app/new/page.tsx
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import NewSetsClient from "./NewSetsClient";

export const metadata: Metadata = {
  title: "New sets",
};

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

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function isSetLite(x: unknown): x is SetLite {
  return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
}

function toSetLiteArray(x: unknown): SetLite[] {
  return Array.isArray(x) ? x.filter(isSetLite) : [];
}

type SetsResponse =
  | SetLite[]
  | {
      results?: unknown;
    };

function asSetsResponse(x: unknown): SetsResponse {
  if (Array.isArray(x)) return toSetLiteArray(x);

  if (typeof x === "object" && x !== null) {
    const o = x as { results?: unknown };
    return { results: o.results };
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

  const raw = await apiFetch<unknown>(`/sets?${params.toString()}`, { cache: "no-store" });
  const data = asSetsResponse(raw);

  const items: SetLite[] = Array.isArray(data)
    ? data
    : Array.isArray(data.results)
      ? toSetLiteArray(data.results)
      : [];

  return items;
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