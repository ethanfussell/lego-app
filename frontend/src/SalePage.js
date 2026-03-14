// frontend/src/SalePage.js
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SetCard from "./SetCard";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function SalePage({
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [themes, setThemes] = useState([]);

  const [searchParams, setSearchParams] = useSearchParams();
  const sort = searchParams.get("sort") || "discount";
  const theme = searchParams.get("theme") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);

  useEffect(() => {
    let cancelled = false;

    async function loadDeals() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("sort", sort);
        params.set("page", String(page));
        params.set("limit", "60");
        if (theme) params.set("theme", theme);

        const resp = await fetch(`${API_BASE}/sets/deals?${params.toString()}`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Deals fetch failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();

        if (!cancelled) {
          setSets(data.results || []);
          setTotal(data.total || 0);
          setThemes(data.themes || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading deals:", err);
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDeals();

    return () => {
      cancelled = true;
    };
  }, [sort, theme, page]);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  }

  return (
    <div>
      <h1>Deals & price drops</h1>
      <p style={{ color: "#666", maxWidth: "540px" }}>
        Sets currently priced below retail across major retailers.
        {total > 0 && <> Found <strong>{total}</strong> deals.</>}
      </p>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem", marginBottom: "1rem" }}>
        <select
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
          style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #ddd" }}
        >
          <option value="discount">Biggest discount</option>
          <option value="savings">Most savings ($)</option>
          <option value="price">Lowest price</option>
          <option value="name">Name</option>
        </select>

        {themes.length > 0 && (
          <select
            value={theme}
            onChange={(e) => updateParam("theme", e.target.value)}
            style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #ddd" }}
          >
            <option value="">All themes</option>
            {themes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>

      {loading && <p>Loading deals…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && sets.length === 0 && (
        <p style={{ color: "#666" }}>
          No deals found right now. Deals appear when retailer prices drop below the official retail price.
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

export default SalePage;
