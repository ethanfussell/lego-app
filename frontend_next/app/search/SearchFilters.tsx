// frontend_next/app/search/SearchFilters.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

/* ── types ───────────────────────────────────────────── */

export type FilterValues = {
  theme: string;
  minYear: string;
  maxYear: string;
  minPieces: string;
  maxPieces: string;
  minRating: number; // 0 = unset, 1-5 = minimum stars
};

export const EMPTY_FILTERS: FilterValues = {
  theme: "",
  minYear: "",
  maxYear: "",
  minPieces: "",
  maxPieces: "",
  minRating: 0,
};

export function activeFilterCount(f: FilterValues): number {
  let n = 0;
  if (f.theme) n++;
  if (f.minYear || f.maxYear) n++;
  if (f.minPieces || f.maxPieces) n++;
  if (f.minRating > 0) n++;
  return n;
}

type Props = {
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  disabled?: boolean;
};

/* ── theme data ──────────────────────────────────────── */

type ThemeItem = { theme: string; set_count: number };

function useThemeList() {
  const [themes, setThemes] = useState<ThemeItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ThemeItem[]>("/themes?limit=200")
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          // Sort by set_count descending for display
          const sorted = [...data].sort((a, b) => (b.set_count || 0) - (a.set_count || 0));
          setThemes(sorted);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return themes;
}

/* ── sub-components ──────────────────────────────────── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function RangeInputs({
  minVal,
  maxVal,
  minPlaceholder,
  maxPlaceholder,
  onMinChange,
  onMaxChange,
  disabled,
}: {
  minVal: string;
  maxVal: string;
  minPlaceholder: string;
  maxPlaceholder: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={minVal}
        onChange={(e) => onMinChange(e.target.value)}
        placeholder={minPlaceholder}
        disabled={disabled}
        className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm tabular-nums outline-none focus:border-zinc-500"
      />
      <span className="text-xs text-zinc-500">–</span>
      <input
        type="number"
        value={maxVal}
        onChange={(e) => onMaxChange(e.target.value)}
        placeholder={maxPlaceholder}
        disabled={disabled}
        className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm tabular-nums outline-none focus:border-zinc-500"
      />
    </div>
  );
}

function StarSelector({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === star ? 0 : star)}
          className={`text-lg transition-colors ${
            star <= value
              ? "text-amber-600"
              : "text-zinc-600 hover:text-amber-600"
          }`}
          title={value === star ? "Clear rating filter" : `${star}+ stars`}
        >
          ★
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1 text-xs text-zinc-500">{value}+</span>
      )}
    </div>
  );
}

/* ── main component ──────────────────────────────────── */

export default function SearchFilters({ values, onChange, disabled }: Props) {
  const themes = useThemeList();
  const [themeSearch, setThemeSearch] = useState("");
  const [themeOpen, setThemeOpen] = useState(false);

  const count = activeFilterCount(values);

  const update = useCallback(
    (patch: Partial<FilterValues>) => {
      onChange({ ...values, ...patch });
    },
    [values, onChange],
  );

  const clearAll = useCallback(() => {
    onChange({ ...EMPTY_FILTERS });
    setThemeSearch("");
  }, [onChange]);

  // Filter theme list by search input
  const filteredThemes = useMemo(() => {
    if (!themeSearch.trim()) return themes.slice(0, 30);
    const q = themeSearch.trim().toLowerCase();
    return themes.filter((t) => t.theme.toLowerCase().includes(q)).slice(0, 30);
  }, [themes, themeSearch]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          Filters
          {count > 0 && (
            <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
              {count}
            </span>
          )}
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Theme */}
      <FilterSection label="Theme">
        <div className="relative">
          <input
            type="text"
            value={values.theme || themeSearch}
            onChange={(e) => {
              setThemeSearch(e.target.value);
              if (values.theme) update({ theme: "" });
              setThemeOpen(true);
            }}
            onFocus={() => setThemeOpen(true)}
            onBlur={() => setTimeout(() => setThemeOpen(false), 150)}
            placeholder="Search themes…"
            disabled={disabled}
            className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-500"
          />
          {values.theme && (
            <button
              type="button"
              onClick={() => { update({ theme: "" }); setThemeSearch(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700"
              title="Clear theme"
            >
              ✕
            </button>
          )}
          {themeOpen && !values.theme && filteredThemes.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
              {filteredThemes.map((t) => (
                <button
                  key={t.theme}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    update({ theme: t.theme });
                    setThemeSearch("");
                    setThemeOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-100"
                >
                  <span>{t.theme}</span>
                  <span className="text-xs text-zinc-500">{t.set_count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </FilterSection>

      {/* Year range */}
      <FilterSection label="Year">
        <RangeInputs
          minVal={values.minYear}
          maxVal={values.maxYear}
          minPlaceholder="1970"
          maxPlaceholder="2026"
          onMinChange={(v) => update({ minYear: v })}
          onMaxChange={(v) => update({ maxYear: v })}
          disabled={disabled}
        />
      </FilterSection>

      {/* Pieces range */}
      <FilterSection label="Pieces">
        <RangeInputs
          minVal={values.minPieces}
          maxVal={values.maxPieces}
          minPlaceholder="0"
          maxPlaceholder="5000+"
          onMinChange={(v) => update({ minPieces: v })}
          onMaxChange={(v) => update({ maxPieces: v })}
          disabled={disabled}
        />
      </FilterSection>

      {/* Min rating */}
      <FilterSection label="Min rating">
        <StarSelector value={values.minRating} onChange={(v) => update({ minRating: v })} disabled={disabled} />
      </FilterSection>
    </div>
  );
}
