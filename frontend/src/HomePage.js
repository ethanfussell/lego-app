// frontend/src/HomePage.js
import React from "react";
import { Link } from "react-router-dom";

function HomePage({ lists, loading, error }) {
  return (
    <div style={{ padding: "1.5rem" }}>
      {/* HERO / INTRO */}
      <section
        style={{
          padding: "1.5rem",
          borderRadius: "12px",
          border: "1px solid #e0e0e0",
          background: "#fafafa",
          marginBottom: "1.75rem",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
          Track your LEGO collection & find the best deals
        </h1>
        <p style={{ margin: 0, color: "#555", maxWidth: "40rem" }}>
          Rate sets, track what you own and want, and compare prices before you
          buy. Built for LEGO nerds like us.
        </p>

        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <Link
            to="/search"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "999px",
              border: "none",
              background: "#222",
              color: "white",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            🔍 Start searching sets
          </Link>

          <Link
            to="/login"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              textDecoration: "none",
              color: "#222",
            }}
          >
            📋 Log in to track your collection
          </Link>
        </div>
      </section>

      {/* FEATURED SETS (placeholder for now) */}
      <section style={{ marginBottom: "1.75rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.75rem",
          }}
        >
          <h2 style={{ margin: 0 }}>⭐ Featured sets</h2>
          <span style={{ fontSize: "0.85rem", color: "#777" }}>
            Hand-picked highlights (coming soon)
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                padding: "0.75rem",
                background: "white",
                minHeight: "140px",
              }}
            >
              <div
                style={{
                  height: "90px",
                  borderRadius: "6px",
                  background:
                    "repeating-linear-gradient(45deg, #eee, #eee 10px, #f8f8f8 10px, #f8f8f8 20px)",
                  marginBottom: "0.5rem",
                }}
              />
              <div
                style={{
                  height: "0.8rem",
                  background: "#eee",
                  borderRadius: "999px",
                  marginBottom: "0.25rem",
                }}
              />
              <div
                style={{
                  height: "0.8rem",
                  background: "#f0f0f0",
                  borderRadius: "999px",
                  width: "70%",
                }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* DEALS & PRICE DROPS */}
      <section style={{ marginBottom: "1.75rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.75rem",
          }}
        >
          <h2 style={{ margin: 0 }}>💸 Deals & price drops</h2>
          <Link
            to="/explore"
            style={{
              fontSize: "0.85rem",
              textDecoration: "none",
              color: "#0070f3",
            }}
          >
            View all deals →
          </Link>
        </div>

        <p style={{ color: "#666", marginTop: 0, marginBottom: "0.75rem" }}>
          This will show sets with current discounts and price history once we
          hook up price data.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1rem",
          }}
        >
          {[1, 2].map((n) => (
            <div
              key={n}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                padding: "0.75rem 0.9rem",
                background: "white",
              }}
            >
              <div
                style={{
                  height: "1rem",
                  background: "#eee",
                  borderRadius: "999px",
                  marginBottom: "0.35rem",
                }}
              />
              <div
                style={{
                  height: "0.8rem",
                  background: "#f0f0f0",
                  borderRadius: "999px",
                  width: "60%",
                  marginBottom: "0.5rem",
                }}
              />
              <button
                style={{
                  marginTop: "0.25rem",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "999px",
                  border: "1px solid #ddd",
                  background: "#fafafa",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                View prices (coming soon)
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* RETIRING SOON + TRENDING (side by side on desktop) */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
          marginBottom: "1.75rem",
        }}
      >
        {/* Retiring soon */}
        <div>
          <h2 style={{ marginTop: 0 }}>⏰ Retiring soon</h2>
          <p style={{ color: "#666", marginTop: 0 }}>
            Sets rumored or confirmed to retire soon. Great for FOMO-driven
            deals and alerts later.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={{ marginBottom: "0.5rem", color: "#555" }}>
              • Placeholder: Modular Building 10xxx
            </li>
            <li style={{ marginBottom: "0.5rem", color: "#555" }}>
              • Placeholder: Star Wars UCS set
            </li>
          </ul>
        </div>

        {/* Trending */}
        <div>
          <h2 style={{ marginTop: 0 }}>🔥 Trending now</h2>
          <p style={{ color: "#666", marginTop: 0 }}>
            Most-viewed and most-added sets across the site.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={{ marginBottom: "0.5rem", color: "#555" }}>
              • Placeholder: “Trending Castle set”
            </li>
            <li style={{ marginBottom: "0.5rem", color: "#555" }}>
              • Placeholder: “New Star Wars starfighter”
            </li>
          </ul>
        </div>
      </section>

      {/* POPULAR PUBLIC LISTS — uses real data you already have */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginTop: 0 }}>📋 Popular public lists</h2>

        <p style={{ color: "#666", marginTop: 0 }}>
          Curated lists from the community. Click a list to see the sets inside.
        </p>

        {loading && <p>Loading public lists…</p>}
        {error && <p style={{ color: "red" }}>Error: {error}</p>}

        {!loading && !error && lists.length === 0 && (
          <p style={{ color: "#666" }}>
            No public lists yet. Once you create some and mark them public,
            they’ll show up here.
          </p>
        )}

        {!loading && !error && lists.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            {lists.map((list) => (
              <li
                key={list.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "0.9rem",
                  background: "white",
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                    marginBottom: "0.25rem",
                    fontSize: "1rem",
                  }}
                >
                  <Link
                    to={`/lists/${list.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    {list.title}
                  </Link>
                </h3>
                {list.description && (
                  <p
                    style={{
                      margin: 0,
                      marginBottom: "0.35rem",
                      fontSize: "0.9rem",
                      color: "#555",
                    }}
                  >
                    {list.description}
                  </p>
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85rem",
                    color: "#777",
                  }}
                >
                  {list.items_count} sets · by{" "}
                  <strong>{list.owner}</strong>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default HomePage;