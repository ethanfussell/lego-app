// frontend/src/SortControls.js
import React from "react";

function SortControls({
  sort,
  order,
  onChangeSort,
  onChangeOrder,
  sortOptions,
}) {
  // NOTE: If you already have a sort UI on another page,
  // paste that exact JSX/style here so everything matches perfectly.
  return (
    <div
      style={{
        display: "flex",
        gap: "0.75rem",
        alignItems: "center",
        flexWrap: "wrap",
        marginTop: "0.75rem",
        marginBottom: "0.75rem",
      }}
    >
      <label style={{ fontSize: "0.9rem", color: "#374151" }}>
        Sort:
        <select
          value={sort}
          onChange={(e) => onChangeSort(e.target.value)}
          style={{
            marginLeft: "0.5rem",
            padding: "0.45rem 0.6rem",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
          }}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: "0.9rem", color: "#374151" }}>
        Order:
        <select
          value={order}
          onChange={(e) => onChangeOrder(e.target.value)}
          style={{
            marginLeft: "0.5rem",
            padding: "0.45rem 0.6rem",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
          }}
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </label>
    </div>
  );
}

export default SortControls;