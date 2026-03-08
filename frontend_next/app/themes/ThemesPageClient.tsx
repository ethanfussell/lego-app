// frontend_next/app/themes/ThemesPageClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { themeToSlug } from "@/lib/slug";

type ThemeRow = { theme: string; set_count: number };
type SortKey = "sets-desc" | "sets-asc" | "name-asc" | "name-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "sets-desc", label: "Most sets" },
  { value: "sets-asc", label: "Fewest sets" },
  { value: "name-asc", label: "A–Z" },
  { value: "name-desc", label: "Z–A" },
];

function sortThemes(themes: ThemeRow[], key: SortKey): ThemeRow[] {
  const copy = [...themes];
  switch (key) {
    case "sets-desc":
      return copy.sort((a, b) => b.set_count - a.set_count);
    case "sets-asc":
      return copy.sort((a, b) => a.set_count - b.set_count);
    case "name-asc":
      return copy.sort((a, b) => a.theme.localeCompare(b.theme));
    case "name-desc":
      return copy.sort((a, b) => b.theme.localeCompare(a.theme));
    default:
      return copy;
  }
}

export default function ThemesPageClient({
  allThemes,
  activeThemes,
}: {
  allThemes: ThemeRow[];
  activeThemes: ThemeRow[];
}) {
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<SortKey>("sets-desc");
  const [query, setQuery] = useState("");

  const themes = showAll ? allThemes : activeThemes;

  const filtered = useMemo(() => {
    if (!query.trim()) return themes;
    const q = query.trim().toLowerCase();
    return themes.filter((t) => t.theme.toLowerCase().includes(q));
  }, [themes, query]);

  const sorted = useMemo(() => sortThemes(filtered, sort), [filtered, sort]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Themes</h1>
          <p className="mt-2 text-zinc-500">Pick a theme to browse sets.</p>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/years" className="text-sm font-semibold text-zinc-900 hover:text-amber-600 hover:underline">
            Browse by year &rarr;
          </Link>
        </div>
      </div>

      {/* Controls row */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {/* Search */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search themes…"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 sm:w-64"
        />

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Active / All toggle */}
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
            showAll
              ? "border-zinc-300 bg-zinc-100 text-zinc-700"
              : "border-amber-500 bg-amber-500 text-black"
          }`}
        >
          {showAll ? "Showing all themes" : "Active themes"}
        </button>
      </div>

      {/* Count */}
      <div className="mt-4 text-sm text-zinc-500">
        {sorted.length} {sorted.length === 1 ? "theme" : "themes"}
        {!showAll && " (recent sets only)"}
      </div>

      {/* Grid */}
      {sorted.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No themes found.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((r) => {
            const href = `/themes/${themeToSlug(r.theme)}`;
            return (
              <Link
                key={r.theme}
                href={href}
                className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:bg-zinc-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">{r.theme}</div>
                  <div className="text-xs font-semibold text-zinc-500">{r.set_count} sets</div>
                </div>
                <div className="mt-1 text-sm text-zinc-500">View sets &rarr;</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
