// frontend_next/app/components/Pagination.tsx
"use client";

import React from "react";

function buildPageNumbers(current: number, total: number) {
  const pages: Array<number | "..."> = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, "...", total);
    return pages;
  }

  if (current >= total - 3) {
    pages.push(1, "...", total - 4, total - 3, total - 2, total - 1, total);
    return pages;
  }

  pages.push(1, "...", current - 1, current, current + 1, "...", total);
  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  disabled,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}) {
  if (!totalItems || totalPages <= 1) return null;

  const pages = buildPageNumbers(currentPage, totalPages);

  const canGoPrev = !disabled && currentPage > 1;
  const canGoNext = !disabled && currentPage < totalPages;

  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="mt-6 border-t border-black/[.08] pt-4 text-sm dark:border-white/[.12]">
      <div className="text-center text-zinc-600 dark:text-zinc-400">
        Showing <span className="font-semibold">{rangeStart}</span> –{" "}
        <span className="font-semibold">{rangeEnd}</span> of{" "}
        <span className="font-semibold">{totalItems}</span> results
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => canGoPrev && onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          className="rounded-full border border-black/[.10] bg-white px-3 py-1 text-sm font-semibold disabled:opacity-50 dark:border-white/[.14] dark:bg-zinc-950"
        >
          ← Prev
        </button>

        {pages.map((p, idx) =>
          p === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-zinc-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => !disabled && p !== currentPage && onPageChange(p)}
              disabled={!!disabled && p !== currentPage}
              className={[
                "rounded-full border px-3 py-1 text-sm font-semibold",
                p === currentPage
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-black/[.10] bg-white text-zinc-900 hover:bg-black/[.04] dark:border-white/[.14] dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-white/[.06]",
              ].join(" ")}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => canGoNext && onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className="rounded-full border border-black/[.10] bg-white px-3 py-1 text-sm font-semibold disabled:opacity-50 dark:border-white/[.14] dark:bg-zinc-950"
        >
          Next →
        </button>
      </div>
    </div>
  );
}