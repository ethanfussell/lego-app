// frontend/src/FeedPage.js
import React, { useEffect, useState } from "react";
import SetCard from "./SetCard";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function FeedPage({
  title,
  description,
  queryParams = {},
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
  variant = "default",   // 👈 NEW
}) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSets() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", queryParams.page?.toString() || "1");
        params.set("limit", queryParams.limit?.toString() || "50");

        if (queryParams.q) params.set("q", queryParams.q);
        if (queryParams.sort) params.set("sort", queryParams.sort);
        if (queryParams.order) params.set("order", queryParams.order);

        const resp = await fetch(`${API_BASE}/sets?${params.toString()}`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Feed fetch failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        const items = Array.isArray(data) ? data : data.results || [];

        if (!cancelled) {
          setSets(items);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading feed:", err);
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSets();

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(queryParams)]);

  const hasResults = sets && sets.length > 0;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      {description && (
        <p style={{ color: "#666", maxWidth: "600px" }}>{description}</p>
      )}

      {loading && <p>Loading sets…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && !hasResults && (
        <p style={{ color: "#777" }}>No sets found for this feed.</p>
      )}

      {!loading && !error && hasResults && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            columnGap: "1rem",
            rowGap: "1.75rem",
          }}
        >
          {sets.map((set) => (
            <li
              key={set.set_num}
              style={{
                width: "100%",
                maxWidth: "260px",   // 👈 helps keep consistent width
              }}
            >
              <SetCard
                set={set}
                isOwned={ownedSetNums?.has(set.set_num)}
                isInWishlist={wishlistSetNums?.has(set.set_num)}
                onMarkOwned={onMarkOwned}
                onAddWishlist={onAddWishlist}
                variant={variant}   // 👈 pass variant through
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FeedPage;