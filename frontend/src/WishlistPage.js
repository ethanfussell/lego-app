// frontend/src/WishlistPage.js
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SetCard from "./SetCard";

function sortSets(arr, sortKey) {
  const items = Array.isArray(arr) ? [...arr] : [];

  const byName = (a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" });

  if (sortKey === "name_asc") items.sort(byName);
  else if (sortKey === "name_desc") items.sort((a, b) => byName(b, a));
  else if (sortKey === "year_desc") items.sort((a, b) => (Number(b?.year || 0) - Number(a?.year || 0)) || byName(a, b));
  else if (sortKey === "year_asc") items.sort((a, b) => (Number(a?.year || 0) - Number(b?.year || 0)) || byName(a, b));
  else if (sortKey === "pieces_desc") items.sort((a, b) => (Number(b?.pieces || 0) - Number(a?.pieces || 0)) || byName(a, b));
  else if (sortKey === "pieces_asc") items.sort((a, b) => (Number(a?.pieces || 0) - Number(a?.pieces || 0)) || byName(a, b));
  else if (sortKey === "rating_desc") items.sort((a, b) => (Number(b?.rating || 0) - Number(a?.rating || 0)) || byName(a, b));
  else if (sortKey === "rating_asc") items.sort((a, b) => (Number(a?.rating || 0) - Number(b?.rating || 0)) || byName(a, b));

  return items;
}

export default function WishlistPage({
  wishlistSets = [],
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const navigate = useNavigate();

  const [sortKey, setSortKey] = useState("name_asc");

  const sortedWishlist = useMemo(() => sortSets(wishlistSets, sortKey), [wishlistSets, sortKey]);
  const total = Array.isArray(wishlistSets) ? wishlistSets.length : 0;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      {/* ✅ Back button matches custom list page */}
      <button
        onClick={() => navigate(-1)}
        style={{
          marginBottom: "1rem",
          padding: "0.35rem 0.75rem",
          borderRadius: "999px",
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Wishlist</h1>
          <p style={{ margin: "0.35rem 0 0 0", color: "#666" }}>
            <strong>{total}</strong> set{total === 1 ? "" : "s"}
          </p>
        </div>

        {/* ✅ Keep sort feature (and no “Collection hub” button) */}
        <label style={{ color: "#444", fontSize: "0.9rem" }}>
          Sort{" "}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            style={{ padding: "0.25rem 0.5rem" }}
          >
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="year_desc">Year (new → old)</option>
            <option value="year_asc">Year (old → new)</option>
            <option value="pieces_desc">Pieces (high → low)</option>
            <option value="pieces_asc">Pieces (low → high)</option>
            <option value="rating_desc">Rating (high → low)</option>
            <option value="rating_asc">Rating (low → high)</option>
          </select>
        </label>
      </div>

      {total === 0 ? (
        <p style={{ color: "#777" }}>No wishlist sets yet.</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
            alignItems: "start",
          }}
        >
          {sortedWishlist.map((set) => (
            <li key={set.set_num} style={{ maxWidth: 260 }}>
              <SetCard
                set={set}
                isOwned={ownedSetNums ? ownedSetNums.has(set.set_num) : false}
                isInWishlist={wishlistSetNums ? wishlistSetNums.has(set.set_num) : true}
                onMarkOwned={onMarkOwned}
                onAddWishlist={onAddWishlist}
                variant="default"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}