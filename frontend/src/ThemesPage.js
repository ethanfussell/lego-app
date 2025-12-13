// frontend/src/ThemesPage.js
import React from "react";
import { Link } from "react-router-dom";

// Central place to define themes + metadata
export const THEMES = [
  {
    slug: "star-wars",
    name: "Star Wars",
    logoText: "SW",
    tagline: "Jedi, Sith, UCS ships and more.",
    query: "Star Wars",
  },
  {
    slug: "harry-potter",
    name: "Harry Potter",
    logoText: "HP",
    tagline: "Hogwarts, Diagon Alley, magical builds.",
    query: "Harry Potter",
  },
  {
    slug: "city",
    name: "City",
    logoText: "CITY",
    tagline: "Everyday life, vehicles and rescue.",
    query: "City",
  },
  {
    slug: "technic",
    name: "Technic",
    logoText: "T",
    tagline: "Advanced building with real mechanisms.",
    query: "Technic",
  },
  {
    slug: "icons",
    name: "Icons / Creator Expert",
    logoText: "IC",
    tagline: "Display models, modulars, and adult sets.",
    query: "Icons",
  },
  {
    slug: "ninjago",
    name: "NINJAGO",
    logoText: "NJ",
    tagline: "Ninja, mechs, and epic temples.",
    query: "NINJAGO",
  },
  {
    slug: "speed-champions",
    name: "Speed Champions",
    logoText: "SC",
    tagline: "Licensed performance cars in brick form.",
    query: "Speed Champions",
  },
  {
    slug: "friends",
    name: "Friends",
    logoText: "F",
    tagline: "Heartlake City stories and characters.",
    query: "Friends",
  },
];

function ThemesPage() {
  return (
    <div style={{ padding: "1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Browse by theme</h1>
      <p
        style={{
          marginTop: "0.5rem",
          color: "#4b5563",
          maxWidth: "600px",
          fontSize: "0.95rem",
        }}
      >
        Pick a LEGO theme to explore sets, track your collection, and find deals
        within that universe.
      </p>

      <div
        style={{
          marginTop: "1.5rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        {THEMES.map((theme) => (
          <Link
            key={theme.slug}
            to={`/themes/${theme.slug}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                borderRadius: "16px",
                border: "1px solid #e5e7eb",
                padding: "1rem",
                background:
                  "linear-gradient(135deg, #020617, #111827)", // dark subtle
                color: "white",
                display: "flex",
                flexDirection: "column",
                gap: "0.7rem",
                height: "100%",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                }}
              >
                {theme.logoText || theme.name[0]}
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: "0.98rem" }}>
                  {theme.name}
                </div>
                {theme.tagline && (
                  <div
                    style={{
                      marginTop: "0.25rem",
                      fontSize: "0.85rem",
                      opacity: 0.9,
                    }}
                  >
                    {theme.tagline}
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "auto",
                  fontSize: "0.78rem",
                  opacity: 0.85,
                }}
              >
                Click to see sets from this theme →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default ThemesPage;