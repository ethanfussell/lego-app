// frontend/src/CollectionsPage.js
import React, { useEffect, useState } from "react";
import SetCard from "./SetCard";

const API_BASE = "http://localhost:8000";

// A reusable row: title + (up to) 3 cards + "View all" button
function CollectionRow({ title, totalCount, sets, viewAllLabel }) {
  if (!sets || sets.length === 0) return null;

  const preview = sets.slice(0, 3);

  return (
    <section style={{ marginTop: "1.75rem" }}>
      {/* Row header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
          <p style={{ margin: "0.2rem 0 0 0", color: "#777", fontSize: "0.9rem" }}>
            {totalCount === 1
              ? "1 set"
              : `${totalCount} sets`}
          </p>
        </div>

        {/* View all button – later this can link to a full page */}
        <button
          type="button"
          style={{
            padding: "0.35rem 0.9rem",
            borderRadius: "999px",
            border: "1px solid #ddd",
            background: "white",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          {viewAllLabel}
        </button>
      </div>

      {/* Cards row */}
      <div
        style={{
          overflowX: "auto",
          paddingBottom: "0.5rem",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            gap: "0.75rem",
          }}
        >
          {preview.map((set) => (
            <li
              key={set.set_num}
              style={{
                minWidth: "220px",
                maxWidth: "220px",
                flex: "0 0 auto",
              }}
            >
              <SetCard
                set={set}
                variant="collection" // 👈 just rating display, no buttons
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CollectionsPage({
  ownedSets,
  wishlistSets,
}) {
  const [ownedDetails, setOwnedDetails] = useState([]);
  const [wishlistDetails, setWishlistDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper: given an array of { set_num, ... }, load full set objects
  async function loadSetDetails(items) {
    const results = await Promise.all(
      (items || []).map(async (item) => {
        try {
          const resp = await fetch(
            `${API_BASE}/sets/${encodeURIComponent(item.set_num)}`
          );
          if (!resp.ok) return null;
          return await resp.json();
        } catch {
          return null;
        }
      })
    );
    return results.filter(Boolean);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);
        setError(null);

        const [ownedFull, wishlistFull] = await Promise.all([
          loadSetDetails(ownedSets || []),
          loadSetDetails(wishlistSets || []),
        ]);

        if (!cancelled) {
          setOwnedDetails(ownedFull);
          setWishlistDetails(wishlistFull);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading collection details:", err);
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [ownedSets, wishlistSets]);

  return (
    <div
      style={{
        padding: "1.5rem",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "1.7rem" }}>Collection</h1>
      <p style={{ marginTop: "0.4rem", color: "#666" }}>
        View sets you&apos;ve marked as Owned or added to your Wishlist.
      </p>

      {loading && <p>Loading collection…</p>}
      {error && (
        <p style={{ color: "red" }}>Error loading collection: {error}</p>
      )}

      {!loading && !error && ownedDetails.length === 0 && wishlistDetails.length === 0 && (
        <p style={{ marginTop: "1rem", color: "#777" }}>
          You haven&apos;t marked any sets as Owned or added them to your Wishlist yet.
        </p>
      )}

      {/* Owned row */}
      <CollectionRow
        title="Owned"
        totalCount={ownedDetails.length}
        sets={ownedDetails}
        viewAllLabel="View all owned"
      />

      {/* Wishlist row */}
      <CollectionRow
        title="Wishlist"
        totalCount={wishlistDetails.length}
        sets={wishlistDetails}
        viewAllLabel="View all wishlist"
      />
    </div>
  );
}

export default CollectionsPage;