// frontend_next/app/sale/SaleClient.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import { apiFetch } from "@/lib/api";
import type { SetLite } from "@/lib/types";
import { formatPrice } from "@/lib/format";

type SortOption = "discount" | "price" | "savings" | "name";

type Props = {
  initialSets: SetLite[];
  totalDeals: number;
  themes: string[];
};

function DealBadge({ pct }: { pct: number }) {
  const tone =
    pct >= 30
      ? "bg-red-500/10 text-red-700"
      : pct >= 15
        ? "bg-amber-500/10 text-amber-700"
        : "bg-emerald-500/10 text-emerald-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}
    >
      {pct}% off
    </span>
  );
}

function DealSummaryBar({ total, maxDiscount }: { total: number; maxDiscount: number }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-zinc-900">{total}</span>
        <span className="text-sm text-zinc-500">
          {total === 1 ? "deal" : "deals"} found
        </span>
      </div>
      {maxDiscount > 0 ? (
        <>
          <span className="text-zinc-300" aria-hidden>|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-zinc-500">Up to</span>
            <span className="text-sm font-bold text-red-600">
              {maxDiscount}% off
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700"
    >
      <option value="discount">Biggest discount</option>
      <option value="savings">Most savings ($)</option>
      <option value="price">Lowest price</option>
      <option value="name">Name A-Z</option>
    </select>
  );
}

function ThemeFilter({
  themes,
  value,
  onChange,
}: {
  themes: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (themes.length === 0) return null;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700"
    >
      <option value="">All themes</option>
      {themes.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

export default function SaleClient({ initialSets, totalDeals, themes }: Props) {
  const { token, hydrated } = useAuth();
  const { isOwned, isWishlist, getUserRating } = useCollectionStatus();

  const [sets, setSets] = useState<SetLite[]>(initialSets);
  const [total, setTotal] = useState(totalDeals);
  const [sortBy, setSortBy] = useState<SortOption>("discount");
  const [themeFilter, setThemeFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const maxDiscount = useMemo(() => {
    let max = 0;
    for (const s of sets) {
      if (typeof s.discount_pct === "number" && s.discount_pct > max) {
        max = s.discount_pct;
      }
    }
    return max;
  }, [sets]);

  const fetchDeals = useCallback(
    async (sort: SortOption, theme: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("sort", sort);
        params.set("order", sort === "name" ? "asc" : "desc");
        params.set("limit", "60");
        if (theme) params.set("theme", theme);

        const data = await apiFetch(`/sets/deals?${params.toString()}`);
        if (data && typeof data === "object" && "results" in data) {
          const d = data as { results: SetLite[]; total: number };
          setSets(d.results ?? []);
          setTotal(d.total ?? 0);
        }
      } catch {
        // keep existing data on error
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  function handleSortChange(newSort: SortOption) {
    setSortBy(newSort);
    fetchDeals(newSort, themeFilter);
  }

  function handleThemeChange(newTheme: string) {
    setThemeFilter(newTheme);
    fetchDeals(sortBy, newTheme);
  }

  type SetCardSetProp = React.ComponentProps<typeof SetCard>["set"];

  return (
    <div>
      <DealSummaryBar total={total} maxDiscount={maxDiscount} />

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SortSelect value={sortBy} onChange={handleSortChange} />
        <ThemeFilter themes={themes} value={themeFilter} onChange={handleThemeChange} />
      </div>

      {/* Loading overlay */}
      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-25"
            />
            <path
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="opacity-75"
            />
          </svg>
          Loading deals...
        </div>
      ) : null}

      {/* Results grid */}
      {!loading && sets.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm font-medium text-zinc-700">No deals match your filters</p>
          <p className="mt-1 text-xs text-zinc-500">Try a different theme or adjust your filters.</p>
        </div>
      ) : null}

      {!loading && sets.length > 0 ? (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
          {sets.map((set) => {
            const hasDeal =
              typeof set.discount_pct === "number" && set.discount_pct > 0;
            const savings =
              typeof set.savings === "number" && set.savings > 0
                ? formatPrice(set.savings)
                : null;

            return (
              <div key={set.set_num} className="relative w-[220px]">
                {/* Discount badge overlay */}
                {hasDeal ? (
                  <div className="absolute top-2 right-2 z-10">
                    <DealBadge pct={set.discount_pct!} />
                  </div>
                ) : null}

                <SetCard
                  set={set as unknown as SetCardSetProp}
                  token={token ?? undefined}
                  isOwnedByUser={isOwned(set.set_num)}
                  userRatingOverride={getUserRating(set.set_num)}
                  footer={
                    <div>
                      {/* Savings line */}
                      {savings ? (
                        <div className="mb-2 text-xs font-medium text-emerald-600">
                          Save {savings}
                        </div>
                      ) : null}

                      {/* Actions */}
                      {hydrated && token ? (
                        <SetCardActions
                          token={token}
                          setNum={set.set_num}
                          isOwned={isOwned(set.set_num)}
                          isWishlist={isWishlist(set.set_num)}
                        />
                      ) : (
                        <div className="text-xs text-zinc-500">
                          Log in to add to lists
                        </div>
                      )}
                    </div>
                  }
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
