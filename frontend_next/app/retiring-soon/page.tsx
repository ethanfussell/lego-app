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

async function fetchRetiringSoonSets(): Promise<SetLite[]> {
  const params = new URLSearchParams();
  params.set("q", "retiring");
  params.set("sort", "rating");
  params.set("order", "desc");
  params.set("page", "1");
  params.set("limit", "60");

  const data = await apiFetch<any>(`/sets?${params.toString()}`, { cache: "no-store" });

  const items: SetLite[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
    ? data.results
    : [];

  return items.filter((s) => typeof s?.set_num === "string" && s.set_num.trim() !== "");
}

export default async function Page() {
  let sets: SetLite[] = [];
  let error: string | null = null;

  try {
    sets = await fetchRetiringSoonSets();
  } catch (e: any) {
    error = e?.message || String(e);
  }

  return <RetiringSoonClient initialSets={sets} initialError={error} />;
}