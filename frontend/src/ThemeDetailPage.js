// frontend/src/ThemeDetailPage.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SetCard from "./SetCard";
import { THEMES } from "./ThemesPage";

const API_BASE = "http://localhost:8000";

const THEME_MAP = new Map(THEMES.map((t) => [t.slug, t]));

function ThemeDetailPage({
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const { themeSlug } = useParams();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const theme = THEME_MAP.get(themeSlug);
  const title = theme ? theme.name : themeSlug;
  const subtitle =
    theme?.short ||
    "Browse sets we think match this theme. Later we can hook into a real theme field from the backend.";

  useEffect(() => {
    let cancelled = false;

    async function loadThemeSets() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        // For now, search by the theme name as text.
        // Later we can switch to a real `theme=` filter when the API supports it.
        params.set("q", theme ? theme.name : themeSlug);
        params.set("sort", "rating");
        params.set("order", "desc");
        params.set("page", "1");
        params.set("limit", "60");

        const resp = await fetch(`${API_BASE}/sets?${params.toString()}`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Theme fetch failed (${resp.status}): ${text}`);
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
  }, [themeSlug, theme]);

  return (
    <div>
      <h1>{title}</h1>
      <p style={{ color: "#666", maxWidth: "560px" }}>{subtitle}</p>

      {loading && <p>Loading sets…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && sets.length === 0 && (
        <p style={{ color: "#666" }}>
          No sets found for this theme yet. We can refine the matching later.
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

export default ThemeDetailPage;