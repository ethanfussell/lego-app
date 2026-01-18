// frontend/src/ThemesPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function ThemesPage() {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Optional: search/filter themes client-side
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadThemes() {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch(`${API_BASE}/themes?limit=500`);
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Themes fetch failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        if (!cancelled) {
          setThemes(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadThemes();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = (q || "").trim().toLowerCase();
    if (!needle) return themes;
    return themes.filter((t) => (t.theme || "").toLowerCase().includes(needle));
  }, [themes, q]);

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Browse by theme</h1>
      <p
        style={{
          marginTop: "0.5rem",
          color: "#4b5563",
          maxWidth: "650px",
          fontSize: "0.95rem",
        }}
      >
        Explore LEGO themes. Each theme page is indexable and paginated.
      </p>

      <div style={{ marginTop: "1rem", maxWidth: "420px" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search themes…"
          style={{
            width: "100%",
            padding: "0.65rem 0.8rem",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            outline: "none",
          }}
        />
      </div>

      {loading && <p style={{ marginTop: "1rem" }}>Loading themes…</p>}
      {error && (
        <p style={{ marginTop: "1rem", color: "red" }}>Error: {error}</p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p style={{ marginTop: "1rem", color: "#6b7280" }}>
          No themes match your search.
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div
          style={{
            marginTop: "1.25rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          {filtered.map((t) => {
            const themeName = t.theme;
            const count = t.set_count ?? 0;

            // IMPORTANT: use encoded theme name as URL param
            const href = `/themes/${encodeURIComponent(themeName)}`;

            return (
              <Link
                key={themeName}
                to={href}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    borderRadius: "16px",
                    border: "1px solid #e5e7eb",
                    padding: "1rem",
                    background: "linear-gradient(135deg, #020617, #111827)",
                    color: "white",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "1rem",
                      lineHeight: 1.2,
                    }}
                  >
                    {themeName}
                  </div>

                  <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                    {count.toLocaleString()} set{count === 1 ? "" : "s"}
                  </div>

                  <div
                    style={{
                      marginTop: "auto",
                      fontSize: "0.78rem",
                      opacity: 0.85,
                    }}
                  >
                    View sets →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ThemesPage;