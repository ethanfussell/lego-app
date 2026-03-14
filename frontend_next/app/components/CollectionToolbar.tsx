// frontend_next/app/components/CollectionToolbar.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import type { SortKey, SortDir } from "@/lib/useCollectionFilters";

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function GridIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function ListIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function FilterIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function EllipsisIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Sort Dropdown                                                       */
/* ------------------------------------------------------------------ */

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date_added", label: "Date added" },
  { key: "name", label: "Name" },
  { key: "year", label: "Year" },
  { key: "theme", label: "Theme" },
  { key: "pieces", label: "Pieces" },
];

function SortDropdown({
  sortKey,
  sortDir,
  onChange,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onChange: (key: SortKey, dir: SortDir) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.key === sortKey);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
      >
        <span className="hidden sm:inline text-zinc-400">Sort:</span>
        <span>{current?.label ?? "Sort"}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
          {SORT_OPTIONS.map((opt) => {
            const isActive = sortKey === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  if (isActive) {
                    onChange(opt.key, sortDir === "desc" ? "asc" : "desc");
                  } else {
                    onChange(opt.key, opt.key === "name" || opt.key === "theme" ? "asc" : "desc");
                  }
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-zinc-50 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <span>{opt.label}</span>
                {isActive && (
                  <span className="text-xs text-zinc-400">
                    {sortDir === "asc" ? "\u2191" : "\u2193"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overflow Menu                                                       */
/* ------------------------------------------------------------------ */

function OverflowMenu({
  onExportCsv,
  onBulkImport,
}: {
  onExportCsv?: () => void;
  onBulkImport?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const hasItems = !!onExportCsv || !!onBulkImport;
  if (!hasItems) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-zinc-200 p-2 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600"
        aria-label="More actions"
      >
        <EllipsisIcon />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
          {onExportCsv && (
            <button
              type="button"
              onClick={() => { onExportCsv(); setOpen(false); }}
              className="flex w-full items-center px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Export CSV
            </button>
          )}
          {onBulkImport && (
            <button
              type="button"
              onClick={() => { onBulkImport(); setOpen(false); }}
              className="flex w-full items-center px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Bulk import
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Theme Filter Chips                                                  */
/* ------------------------------------------------------------------ */

function ThemeFilterChips({
  themes,
  selected,
  onToggle,
}: {
  themes: { theme: string; count: number }[];
  selected: string[];
  onToggle: (theme: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {themes.map(({ theme, count }) => {
        const isSelected = selected.includes(theme);
        return (
          <button
            key={theme}
            type="button"
            onClick={() => onToggle(theme)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isSelected
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : "bg-zinc-100 text-zinc-600 border border-transparent hover:bg-zinc-200"
            }`}
          >
            {theme} ({count})
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Toolbar                                                        */
/* ------------------------------------------------------------------ */

export type CollectionToolbarProps = {
  // Search
  search: string;
  onSearchChange: (q: string) => void;
  // Sort
  sortKey: SortKey;
  sortDir: SortDir;
  onSortChange: (key: SortKey, dir: SortDir) => void;
  // Filter
  availableThemes: { theme: string; count: number }[];
  selectedThemes: string[];
  onToggleTheme: (theme: string) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
  // View mode
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  // Counts
  totalCount: number;
  filteredCount: number;
  // Actions
  onExportCsv?: () => void;
  onBulkImport?: () => void;
};

export default function CollectionToolbar({
  search,
  onSearchChange,
  sortKey,
  sortDir,
  onSortChange,
  availableThemes,
  selectedThemes,
  onToggleTheme,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
  viewMode,
  onViewModeChange,
  totalCount,
  filteredCount,
  onExportCsv,
  onBulkImport,
}: CollectionToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="sticky top-0 z-10 -mx-6 border-b border-zinc-100 bg-white/95 px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search input */}
        <div className="relative min-w-0 flex-1 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search sets..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-700 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-amber-500/10"
          />
        </div>

        {/* Sort */}
        <SortDropdown sortKey={sortKey} sortDir={sortDir} onChange={onSortChange} />

        {/* Filter toggle */}
        {availableThemes.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              hasActiveFilters
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            <FilterIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Filtered count indicator */}
        {filteredCount !== totalCount && (
          <span className="hidden sm:inline text-xs text-zinc-400">
            {filteredCount} of {totalCount}
          </span>
        )}

        {/* View toggle */}
        <div className="inline-flex rounded-lg border border-zinc-200 p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`rounded-md p-1.5 transition-colors ${
              viewMode === "grid" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
            }`}
            aria-label="Grid view"
          >
            <GridIcon />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`rounded-md p-1.5 transition-colors ${
              viewMode === "list" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
            }`}
            aria-label="List view"
          >
            <ListIcon />
          </button>
        </div>

        {/* Overflow menu */}
        <OverflowMenu onExportCsv={onExportCsv} onBulkImport={onBulkImport} />
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3">
          <ThemeFilterChips themes={availableThemes} selected={selectedThemes} onToggle={onToggleTheme} />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs text-zinc-500 transition-colors hover:text-zinc-700"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
