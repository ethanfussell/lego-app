// src/NewSetsPage.js
import React, { useEffect, useState } from "react";
import SetCard from "./SetCard";

const API_BASE = "http://localhost:8000";

// Reusable horizontal row of SetCards (carousel-style)
function SetRow({
  title,
  subtitle,
  sets,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  if (!sets || sets.length === 0) return null;

  return (
    <section style={{ marginBottom: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.5rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
          {subtitle && (
            <p
              style={{
                margin: "0.2rem 0 0 0",
                fontSize: "0.9rem",
                color: "#6b7280",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          overflowX: "auto",
          paddingBottom: "0.5rem",
        }}
      >
        <ul
          style={{
            display: "flex",
            gap: "0.75rem",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {sets.map((set) => (
            <li
              key={set.set_num}
              style={{ minWidth: "220px", maxWidth: "220px", flex: "0 0 auto" }}
            >
              <SetCard
                set={set}
                isOwned={ownedSetNums?.has(set.set_num)}
                isInWishlist={wishlistSetNums?.has(set.set_num)}
                onMarkOwned={onMarkOwned}
                onAddWishlist={onAddWishlist}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function NewSetsPage({
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const [newSets, setNewSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchNew() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("q", "lego");
        params.set("sort", "year");
        params.set("order", "desc"); // newest first
        params.set("page", "1");
        params.set("limit", "80");

        const resp = await fetch(`${API_BASE}/sets?${params.toString()}`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`New sets feed failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        const items = Array.isArray(data) ? data : data.results || [];

        if (!cancelled) {
          setNewSets(items);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading new sets:", err);
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchNew();

    return () => {
      cancelled = true;
    };
  }, []);

  // simple slices (no featured card)
  const justReleased = newSets.slice(0, 12);
  const moreNewRow = newSets.slice(12, 24);
  const moreNewGrid = newSets.slice(24);

  return (
    <div
      style={{
        maxWidth: "1120px",
        margin: "0 auto",
      }}
    >
      {/* Simple hero – full width, no featured card on the right */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>New LEGO sets</h1>
        <p style={{ marginTop: "0.5rem", color: "#666", maxWidth: "560px" }}>
          See the latest LEGO releases first. Scroll through the newest sets,
          spotlighted picks, and upcoming releases all in one place.
        </p>
        <p
          style={{
            marginTop: "0.4rem",
            fontSize: "0.8rem",
            color: "#9ca3af",
          }}
        >
          Placeholder feed · later this will sync with real release data.
        </p>
      </section>

      {loading && <p>Loading new sets…</p>}
      {error && (
        <p style={{ color: "red" }}>Error loading new sets: {error}</p>
      )}

      {!loading && !error && newSets.length === 0 && (
        <p>No new sets found yet.</p>
      )}

      {/* Row 1: absolute newest */}
      <SetRow
        title="Just released"
        subtitle="The absolute newest sets, sorted by release year."
        sets={justReleased}
        ownedSetNums={ownedSetNums}
        wishlistSetNums={wishlistSetNums}
        onMarkOwned={onMarkOwned}
        onAddWishlist={onAddWishlist}
      />

      {/* Row 2: more new stuff */}
      <SetRow
        title="More new sets"
        subtitle="Keep scrolling for even more fresh releases."
        sets={moreNewRow}
        ownedSetNums={ownedSetNums}
        wishlistSetNums={wishlistSetNums}
        onMarkOwned={onMarkOwned}
        onAddWishlist={onAddWishlist}
      />

      {/* Grid of the rest */}
      {moreNewGrid.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>All recent releases</h2>
          <p
            style={{
              margin: "0.2rem 0 1rem 0",
              fontSize: "0.9rem",
              color: "#6b7280",
            }}
          >
            Explore even more of the latest sets.
          </p>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {moreNewGrid.map((set) => (
              <li key={set.set_num}>
                <SetCard
                  set={set}
                  isOwned={ownedSetNums?.has(set.set_num)}
                  isInWishlist={wishlistSetNums?.has(set.set_num)}
                  onMarkOwned={onMarkOwned}
                  onAddWishlist={onAddWishlist}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default NewSetsPage;