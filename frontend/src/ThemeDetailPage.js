// frontend/src/ThemeDetailPage.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SetCard from "./SetCard";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function ThemeDetailPage({
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const { themeSlug } = useParams();

  // Nice-looking name from slug: "lego-city" -> "Lego City"
  const prettyName = themeSlug
    ? decodeURIComponent(themeSlug)
        .replace(/-/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase())
    : "Theme";

  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadThemeSets() {
      try {
        setLoading(true);
        setError(null);

        const searchTerm = decodeURIComponent(themeSlug).replace(/-/g, " ");

        const params = new URLSearchParams();
        params.set("q", searchTerm);      // use existing search endpoint
        params.set("sort", "year");       // newest first feels good here
        params.set("order", "desc");
        params.set("page", "1");
        params.set("limit", "60");

        const resp = await fetch(`${API_BASE}/sets?${params.toString()}`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Theme search failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        const items = Array.isArray(data) ? data : data.results || [];

        if (!cancelled) {
          setSets(items);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading theme sets:", err);
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadThemeSets();

    return () => {
      cancelled = true;
    };
  }, [themeSlug]);

  const hasResults = sets && sets.length > 0;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>{prettyName}</h1>
      <p style={{ color: "#666", maxWidth: "600px" }}>
        Sets that match this theme (placeholder search using the theme name).
      </p>

      {loading && <p>Loading sets…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && !hasResults && (
        <p style={{ color: "#777" }}>No sets found for this theme.</p>
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

export default ThemeDetailPage;