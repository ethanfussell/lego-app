// src/MyCollectionsPanel.js
import React from "react";

/**
 * A presentational component that shows:
 * - Owned sets
 * - Wishlist sets
 *
 * It doesn't fetch anything itself. It just receives props
 * from App and renders UI.
 */
function MyCollectionsPanel({ owned, wishlist, loading, error }) {
  return (
    <section style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
      <h2>My Collections</h2>

      {loading && <p>Loading your collections…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            marginTop: "0.5rem",
          }}
        >
          {/* Owned */}
          <div
            style={{
              flex: "1 1 240px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <h3>Owned</h3>
            <p>
              Sets in Owned: <strong>{owned.length}</strong>
            </p>

            {owned.length === 0 && (
              <p style={{ color: "#666" }}>
                You haven&apos;t marked any sets as Owned yet.
              </p>
            )}

            {owned.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  marginTop: "0.5rem",
                }}
              >
                {owned.map((item) => (
                  <li key={item.set_num}>
                    {item.set_num}{" "}
                    <span style={{ color: "#888" }}>({item.type})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Wishlist */}
          <div
            style={{
              flex: "1 1 240px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <h3>Wishlist</h3>
            <p>
              Sets in Wishlist: <strong>{wishlist.length}</strong>
            </p>

            {wishlist.length === 0 && (
              <p style={{ color: "#666" }}>
                You haven&apos;t added any sets to your Wishlist yet.
              </p>
            )}

            {wishlist.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  marginTop: "0.5rem",
                }}
              >
                {wishlist.map((item) => (
                  <li key={item.set_num}>
                    {item.set_num}{" "}
                    <span style={{ color: "#888" }}>({item.type})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default MyCollectionsPanel;