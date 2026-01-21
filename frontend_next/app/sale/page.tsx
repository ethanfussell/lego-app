// frontend_next/app/sale/page.tsx
import SetCard from "@/app/components/SetCard";
import { apiFetch } from "@/lib/api";

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

async function fetchSaleSets() {
  const params = new URLSearchParams();
  // Placeholder: later switch to a real discount filter/sort
  params.set("q", "lego");
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

  return items;
}

export default async function Page() {
  let sets: SetLite[] = [];
  let error: string | null = null;

  try {
    sets = await fetchSaleSets();
  } catch (e: any) {
    error = e?.message || String(e);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">Deals & price drops</h1>
        <p className="mt-2 max-w-[540px] text-sm text-zinc-500">
          Browse highly-rated LEGO sets that we’ll eventually sort by discounts and price drops from different shops.
        </p>

        {error ? <p className="mt-4 text-sm text-red-600">Error: {error}</p> : null}

        {!error && sets.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No sets found for this category yet.</p>
        ) : null}

        {!error && sets.length > 0 ? (
          <ul className="mt-6 grid list-none gap-4 p-0 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {sets.map((set) => (
              <li key={set.set_num}>
                <SetCard set={set as any} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}