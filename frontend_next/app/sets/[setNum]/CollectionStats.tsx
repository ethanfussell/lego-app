// frontend_next/app/sets/[setNum]/CollectionStats.tsx
"use client";

import React, { useEffect, useState } from "react";

type Stats = {
  owned_count: number;
  wishlist_count: number;
  custom_list_count: number;
};

const BARS = [
  { key: "owned_count" as const, label: "Owned", color: "#f59e0b" },
  { key: "wishlist_count" as const, label: "Wishlist", color: "#3b82f6" },
  { key: "custom_list_count" as const, label: "In Lists", color: "#8b5cf6" },
];

export default function CollectionStats({ setNum }: { setNum: string }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch(`/api/sets/${encodeURIComponent(setNum)}/collection-stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.owned_count === "number") setStats(data);
      })
      .catch(() => {});
  }, [setNum]);

  if (!stats) return null;

  const total = stats.owned_count + stats.wishlist_count + stats.custom_list_count;
  if (total === 0) return null;

  const maxCount = Math.max(1, ...BARS.map((b) => stats[b.key]));

  return (
    <section className="mt-5">
      <h2 className="text-sm font-semibold text-zinc-900">Community</h2>
      <p className="mt-0.5 text-xs text-zinc-500">
        {total.toLocaleString()} {total === 1 ? "collector has" : "collectors have"} this set
      </p>

      <div className="mt-2.5 space-y-2">
        {BARS.map((bar) => {
          const count = stats[bar.key];
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

          return (
            <div key={bar.key} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-xs font-medium text-zinc-600">
                {bar.label}
              </span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-zinc-100">
                <div
                  className="h-full rounded-md transition-all duration-300 ease-out"
                  style={{
                    width: `${Math.max(pct, count > 0 ? 3 : 0)}%`,
                    backgroundColor: bar.color,
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-xs font-semibold text-zinc-700">
                {count.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
