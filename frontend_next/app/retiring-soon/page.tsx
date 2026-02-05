// frontend_next/app/retiring-soon/page.tsx
import { apiFetch } from "@/lib/api";
import RetiringSoonClient from "./RetiringSoonClient";

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