// frontend_next/app/new/page.tsx
import { apiFetch } from "@/lib/api";
import NewSetsClient from "./NewSetsClient";

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

async function fetchNewSets() {
  const params = new URLSearchParams();
  params.set("q", "lego");
  params.set("sort", "year");
  params.set("order", "desc"); // newest first
  params.set("page", "1");
  params.set("limit", "80");

  const data = await apiFetch<any>(`/sets?${params.toString()}`, { cache: "no-store" });

  const items: SetLite[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
    ? data.results
    : [];

  return items;
}

export default async function Page() {
  let sets: SetLite[] = [];
  let error: string | null = null;

  try {
    sets = await fetchNewSets();
  } catch (e: any) {
    error = e?.message || String(e);
  }

  return <NewSetsClient initialSets={sets} initialError={error} />;
}