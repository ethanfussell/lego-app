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
    <section className="mt-10">
      <h2 className="text-lg font-bold text-zinc-900">Community</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {total.toLocaleString()} {total === 1 ? "collector has" : "collectors have"} this set
      </p>

      <div className="mt-4 space-y-3">
        {BARS.map((bar) => {
          const count = stats[bar.key];
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

          return (
            <div key={bar.key} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-right text-sm font-medium text-zinc-600">
                {bar.label}
              </span>
              <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-zinc-100">
                <div
                  className="h-full rounded-lg transition-all duration-300 ease-out"
                  style={{
                    width: `${Math.max(pct, count > 0 ? 3 : 0)}%`,
                    backgroundColor: bar.color,
                  }}
                />
              </div>
              <span className="w-10 shrink-0 text-sm font-semibold text-zinc-700">
                {count.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
