// frontend/src/ThemesPage.js
import React from "react";
import { useNavigate } from "react-router-dom";

// Exported so ThemeDetailPage can reuse the same list
export const THEMES = [
  {
    slug: "star-wars",
    name: "Star Wars",
    short: "Iconic ships and scenes.",
    color: "#111827",
  },
  {
    slug: "city",
    name: "City",
    short: "Everyday life, vehicles, and buildings.",
    color: "#1d4ed8",
  },
  {
    slug: "technics",
    name: "Technic",
    short: "Advanced builds with functions.",
    color: "#0f766e",
  },
  {
    slug: "icons",
    name: "Icons / Creator Expert",
    short: "Display models for adult fans.",
    color: "#7c2d12",
  },
  {
    slug: "harry-potter",
    name: "Harry Potter",
    short: "Hogwarts, Diagon Alley, and more.",
    color: "#6d28d9",
  },
  {
    slug: "marvel",
    name: "Marvel Super Heroes",
    short: "Avengers, Spider-Man, and more.",
    color: "#b91c1c",
  },
  {
    slug: "ninjago",
    name: "NINJAGO",
    short: "Ninjas, mechs, and dragons.",
    color: "#16a34a",
  },
  {
    slug: "friends",
    name: "Friends",
    short: "Heartlake City adventures.",
    color: "#db2777",
  },
  {
    slug: "speed-champions",
    name: "Speed Champions",
    short: "Licensed performance cars.",
    color: "#0e7490",
  },
  {
    slug: "ideas",
    name: "Ideas",
    short: "Fan-designed sets turned real.",
    color: "#ca8a04",
  },
];

function ThemesPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Themes</h1>
      <p style={{ color: "#666", maxWidth: "560px" }}>
        Browse LEGO themes and dive into sets from your favorite worlds. Later
        we can plug in official logos and theme descriptions from the backend.
      </p>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          marginTop: "1.5rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        {THEMES.map((theme) => (
          <li key={theme.slug}>
            <button
              type="button"
              onClick={() => navigate(`/themes/${theme.slug}`)}
              style={{
                width: "100%",
                borderRadius: "16px",
                border: "1px solid #e5e7eb",
                background: "white",
                padding: "1rem 1rem 1.1rem 1rem",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "0.65rem",
              }}
            >
              {/* Logo / icon placeholder */}
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "16px",
                  background: theme.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                }}
              >
                {theme.name
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1rem",
                  }}
                >
                  {theme.name}
                </h2>
                {theme.short && (
                  <p
                    style={{
                      margin: "0.25rem 0 0 0",
                      fontSize: "0.85rem",
                      color: "#6b7280",
                    }}
                  >
                    {theme.short}
                  </p>
                )}
              </div>

              <span
                style={{
                  marginTop: "0.3rem",
                  fontSize: "0.85rem",
                  color: "#4b5563",
                }}
              >
                View sets →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ThemesPage;