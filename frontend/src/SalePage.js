// frontend/src/SalePage.js
import React, { useEffect, useState } from "react";
import SetCard from "./SetCard";

const API_BASE = "http://localhost:8000";

function SalePage({
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

    async function loadSaleSets() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        // 🔧 Placeholder: later we’ll switch this to a real "discount" sort/filter
        params.set("q", "lego");
        params.set("sort", "rating");
        params.set("order", "desc");
        params.set("page", "1");
        params.set("limit", "60");

        const resp = await fetch(`${API_BASE}/sets?${params.toString()}`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Sale fetch failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        const items = Array.isArray(data) ? data : data.results || [];

        if (!cancelled) {
          setSets(items);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading sale sets:", err);
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSaleSets();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1>Deals & price drops</h1>
      <p style={{ color: "#666", maxWidth: "540px" }}>
        Browse highly-rated LEGO sets that we&apos;ll eventually sort by
        discounts and price drops from different shops.
      </p>

      {loading && <p>Loading deals…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && sets.length === 0 && (
        <p style={{ color: "#666" }}>No sets found for this category yet.</p>
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
                isOwned={ownedSetNums?.has(set.set_num)}
                isInWishlist={wishlistSetNums?.has(set.set_num)}
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

export default SalePage;