// frontend/src/NewSetsPage.js
import React, { useEffect, useState } from "react";
import SetCard from "./SetCard";

const API_BASE = "http://localhost:8000";

function NewSetsPage({
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadNewSets() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        // Generic query just to get a good spread of sets
        params.set("q", "lego");
        // Newest by year first (later you can refine this)
        params.set("sort", "year");
        params.set("order", "desc");
        params.set("page", "1");
        params.set("limit", "60");

        const resp = await fetch(`${API_BASE}/sets?${params.toString()}`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`New sets fetch failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        let items = Array.isArray(data) ? data : data.results || [];

        // Optional: filter out weird records that don't have a year
        items = items.filter((s) => typeof s.year === "number");

        if (!cancelled) {
          setSets(items);
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

    loadNewSets();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1>New & recent LEGO sets</h1>
      <p style={{ color: "#666", maxWidth: "640px" }}>
        Browse the newest sets first. Later this page can power gift guides and
        “what&apos;s new” content.
      </p>

      {loading && <p>Loading new sets…</p>}
      {error && (
        <p style={{ color: "red" }}>Error loading new sets: {error}</p>
      )}

      {!loading && !error && sets.length === 0 && (
        <p style={{ color: "#666" }}>No sets found yet.</p>
      )}

      {!loading && !error && sets.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: "1.25rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            columnGap: "1rem",
            rowGap: "1.75rem",
          }}
        >
          {sets.map((set) => (
            <li key={set.set_num}>
              <SetCard
                set={set}
                isOwned={ownedSetNums ? ownedSetNums.has(set.set_num) : false}
                isInWishlist={
                  wishlistSetNums ? wishlistSetNums.has(set.set_num) : false
                }
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

export default NewSetsPage;