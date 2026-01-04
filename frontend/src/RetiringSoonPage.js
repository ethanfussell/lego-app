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

  useEffect(() => {
    let cancelled = false;

    async function loadRetiringSets() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        // 🔧 Placeholder: later we can support a real "status=retiring" filter
        params.set("q", "retiring");
        params.set("sort", "rating");
        params.set("order", "desc");
        params.set("page", "1");
        params.set("limit", "60");

        const resp = await fetch(`${API_BASE}/sets?${params.toString()}`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Retiring soon fetch failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        const items = Array.isArray(data) ? data : data.results || [];

        if (!cancelled) {
          setSets(items);
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
        Last-chance sets. Later this page will show sets that are officially
        marked as retiring soon so you can grab them before they disappear.
      </p>

      {loading && <p>Loading retiring sets…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && sets.length === 0 && (
        <p style={{ color: "#666" }}>No &quot;retiring soon&quot; sets yet.</p>
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