// frontend_next/app/sets/[setNum]/CollectionStats.tsx
"use client";

import React, { useEffect, useState } from "react";

type Stats = {
  owned_count: number;
  wishlist_count: number;
  custom_list_count: number;
};

const CARDS = [
  { key: "owned_count" as const, label: "Owned", bg: "#f59e0b" },
  { key: "wishlist_count" as const, label: "Wishlist", bg: "#3b82f6" },
  { key: "custom_list_count" as const, label: "In Custom Lists", bg: "#8b5cf6" },
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

  return (
    <div className="mt-3 grid grid-cols-3 gap-2.5">
        {CARDS.map((card) => {
          const count = stats[card.key];
          return (
            <div
              key={card.key}
              className="rounded-xl px-2 py-2.5 text-center"
              style={{ backgroundColor: card.bg }}
            >
              <div className="text-lg font-bold text-white">
                {count.toLocaleString()}
              </div>
              <div className="mt-0.5 text-[10px] font-medium text-white/85">
                {card.label}
              </div>
            </div>
          );
        })}
    </div>
  );
}
