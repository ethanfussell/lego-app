// src/Pagination.js
import React from "react";

function buildPageNumbers(current, total) {
    const pages = [];
  
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
      return pages;
    }
  
    // ✅ Near the beginning (show 1–5, then ellipsis, then last)
    if (current <= 4) {
      pages.push(1, 2, 3, 4, 5, "...", total);
      return pages;
    }
  
    // ✅ Near the end (show first, ellipsis, then last 5)
    if (current >= total - 3) {
      pages.push(
        1,
        "...",
        total - 4,
        total - 3,
        total - 2,
        total - 1,
        total
      );
      return pages;
    }
  
    // ✅ In the middle
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
}) {
  // If there are no items or only 1 page, don't show pagination
  if (!totalItems || totalPages <= 1) {
    return null;
  }

  const pages = buildPageNumbers(currentPage, totalPages);

  const canGoPrev = !disabled && currentPage > 1;
  const canGoNext = !disabled && currentPage < totalPages;

  function handlePrev() {
    if (canGoPrev) {
      onPageChange(currentPage - 1);
    }
  }

  function handleNext() {
    if (canGoNext) {
      onPageChange(currentPage + 1);
    }
  }

  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      style={{
        marginTop: "1.25rem",
        paddingTop: "0.75rem",
        borderTop: "1px solid #eee",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        fontSize: "0.9rem",
      }}
    >
      {/* Info line */}
      <div style={{ textAlign: "center" }}>
        Showing <strong>{rangeStart}</strong> – <strong>{rangeEnd}</strong> of{" "}
        <strong>{totalItems}</strong> results
      </div>

      {/* Pager */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
          flexWrap: "wrap",
        }}
      >
        {/* Prev pill */}
        <button
          onClick={handlePrev}
          disabled={!canGoPrev}
          style={{
            padding: "0.25rem 0.75rem",
            borderRadius: "999px",
            border: "1px solid #ccc",
            backgroundColor: canGoPrev ? "#fff" : "#f5f5f5",
            color: canGoPrev ? "#333" : "#aaa",
            cursor: canGoPrev ? "pointer" : "default",
            fontSize: "0.85rem",
          }}
        >
          ← Prev
        </button>

        {/* Numbered pills */}
        {pages.map((p, idx) =>
          p === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              style={{
                padding: "0.2rem 0.5rem",
                color: "#888",
                fontSize: "0.85rem",
              }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => {
                if (!disabled && p !== currentPage) {
                  onPageChange(p);
                }
              }}
              disabled={disabled && p !== currentPage}
              style={{
                padding: "0.25rem 0.75rem",
                borderRadius: "999px",
                border:
                  p === currentPage ? "1px solid #333" : "1px solid #ccc",
                backgroundColor: p === currentPage ? "#333" : "#fff",
                color: p === currentPage ? "#fff" : "#333",
                fontWeight: p === currentPage ? "600" : "400",
                cursor:
                  disabled || p === currentPage ? "default" : "pointer",
                fontSize: "0.85rem",
                boxShadow:
                  p === currentPage
                    ? "0 0 0 2px rgba(0, 0, 0, 0.05)"
                    : "none",
              }}
            >
              {p}
            </button>
          )
        )}

        {/* Next pill */}
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          style={{
            padding: "0.25rem 0.75rem",
            borderRadius: "999px",
            border: "1px solid #ccc",
            backgroundColor: canGoNext ? "#fff" : "#f5f5f5",
            color: canGoNext ? "#333" : "#aaa",
            cursor: canGoNext ? "pointer" : "default",
            fontSize: "0.85rem",
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}