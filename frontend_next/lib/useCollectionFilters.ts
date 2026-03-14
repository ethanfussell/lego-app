// frontend_next/lib/useCollectionFilters.ts
"use client";

import { useMemo, useState } from "react";
import type { SetLite } from "@/lib/types";

export type SortKey = "date_added" | "name" | "year" | "theme" | "pieces";
export type SortDir = "asc" | "desc";

export type CollectionSet = SetLite & {
  collection_created_at?: string | null;
};

export function useCollectionFilters<T extends CollectionSet>(sets: T[]) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date_added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([0, 9999]);

  const availableThemes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sets) {
      const t = s.theme || "Unknown";
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([theme, count]) => ({ theme, count }));
  }, [sets]);

  const yearBounds = useMemo<[number, number]>(() => {
    if (sets.length === 0) return [2000, 2026];
    let min = 9999;
    let max = 0;
    for (const s of sets) {
      const y = s.year ?? 0;
      if (y > 0) {
        if (y < min) min = y;
        if (y > max) max = y;
      }
    }
    return min <= max ? [min, max] : [2000, 2026];
  }, [sets]);

  const hasActiveFilters = selectedThemes.length > 0 || yearRange[0] > 0 || yearRange[1] < 9999;
  const activeFilterCount = (selectedThemes.length > 0 ? 1 : 0) + (yearRange[0] > 0 || yearRange[1] < 9999 ? 1 : 0);

  const filtered = useMemo(() => {
    let result = [...sets];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          s.set_num.toLowerCase().includes(q) ||
          (s.theme || "").toLowerCase().includes(q),
      );
    }

    // Theme filter
    if (selectedThemes.length > 0) {
      result = result.filter((s) => selectedThemes.includes(s.theme || "Unknown"));
    }

    // Year range
    if (yearRange[0] > 0 || yearRange[1] < 9999) {
      result = result.filter((s) => {
        const y = s.year ?? 0;
        return y >= yearRange[0] && y <= yearRange[1];
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date_added":
          cmp = (a.collection_created_at ?? "").localeCompare(b.collection_created_at ?? "");
          break;
        case "name":
          cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        case "year":
          cmp = (a.year ?? 0) - (b.year ?? 0);
          break;
        case "theme":
          cmp = (a.theme ?? "").localeCompare(b.theme ?? "");
          break;
        case "pieces":
          cmp = (a.num_parts ?? a.pieces ?? 0) - (b.num_parts ?? b.pieces ?? 0);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [sets, search, sortKey, sortDir, selectedThemes, yearRange]);

  function clearFilters() {
    setSelectedThemes([]);
    setYearRange([0, 9999]);
  }

  function toggleTheme(theme: string) {
    setSelectedThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme],
    );
  }

  return {
    search,
    setSearch,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
    selectedThemes,
    setSelectedThemes,
    toggleTheme,
    yearRange,
    setYearRange,
    yearBounds,
    availableThemes,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    filtered,
    totalCount: sets.length,
    filteredCount: filtered.length,
  };
}
