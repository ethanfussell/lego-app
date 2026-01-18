// frontend/src/RatingHistogram.js
import React, { useMemo } from "react";

const DEFAULT_BINS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

export default function RatingHistogram({
  histogram,
  bins = DEFAULT_BINS,
  height = 120,
  barWidth = 44,
  gap = 12,
  showLabels = true,
  maxWidth = 760,
  paddingY = 8,          // ✅ new
  paddingX = 4,          // ✅ new
}) {
  const rows = useMemo(() => {
    const h = histogram || {};
    return bins.map((b) => {
      const key = b.toFixed(1);
      return { rating: b, count: Number(h[key] ?? h[b] ?? 0) };
    });
  }, [histogram, bins]);

  const MIN_ZERO_PX = 6;
  const MIN_NONZERO_PX = 8;

  const maxCount = Math.max(1, ...rows.map((r) => Number(r.count || 0)));

  const labelSpace = showLabels ? 18 : 0;
  const chartHeight = Math.max(16, height - labelSpace);

  function barPx(count) {
    const c = Number(count || 0);
    if (c <= 0) return MIN_ZERO_PX;
    const scaled = Math.round((c / maxCount) * chartHeight);
    return Math.max(MIN_NONZERO_PX, scaled);
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth,
          display: "grid",
          gridTemplateColumns: `repeat(${rows.length}, ${barWidth}px)`,
          justifyContent: "center",
          columnGap: gap,
          alignItems: "end",
          padding: `${paddingY}px ${paddingX}px`,  // ✅ controllable
        }}
      >
        {rows.map((r) => {
          const barH = barPx(r.count);
          const isZero = Number(r.count || 0) === 0;

          return (
            <div
              key={r.rating}
              title={`${r.rating.toFixed(1)} ★ · ${r.count}`}
              style={{ display: "grid", justifyItems: "center", gap: showLabels ? 8 : 0 }}
            >
              <div
                style={{
                  width: barWidth,
                  height: chartHeight,
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: barH,
                    borderRadius: 10,
                    background: isZero ? "#e5e7eb" : "#111827",
                    border: isZero ? "1px solid #d1d5db" : "1px solid transparent",
                    transition: "height 160ms ease",
                  }}
                />
              </div>

              {showLabels ? (
                <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 900 }}>
                  {r.rating.toFixed(1)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}