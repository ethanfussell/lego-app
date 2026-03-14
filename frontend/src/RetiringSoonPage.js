// frontend/src/RetiringSoonPage.js
import React, { useEffect, useState } from "react";
import SetCard from "./SetCard";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function RetiringSoonPage({
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadRetiringSets() {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch(`${API_BASE}/sets/retiring?limit=100`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Retiring soon fetch failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        const items = Array.isArray(data) ? data : data.results || [];
        const totalCount = parseInt(resp.headers.get("X-Total-Count") || "0", 10);

        if (!cancelled) {
          setSets(items);
          setTotal(totalCount || items.length);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading retiring soon sets:", err);
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRetiringSets();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1>Retiring soon</h1>
      <p style={{ color: "#666", maxWidth: "540px" }}>
        These sets are expected to retire soon. Grab them before they disappear from store shelves.
        {total > 0 && <> Currently <strong>{total}</strong> sets retiring soon.</>}
      </p>

      {loading && <p>Loading retiring sets…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && sets.length === 0 && (
        <p style={{ color: "#666" }}>
          No sets flagged as retiring yet. Retirement data comes from Brickset
          and is updated regularly.
        </p>
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

export default RetiringSoonPage;
