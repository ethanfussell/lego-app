// frontend/src/HomePage.js
import React, { useRef } from "react";
import { Link } from "react-router-dom";

function HomePage({ lists, loading, error }) {
  const dealsRowRef = useRef(null);
  const retiringRowRef = useRef(null);

  const CARD_MIN_WIDTH = 220;

  function scrollRow(ref, direction = 1) {
    if (!ref.current) return;
    const scrollAmount = CARD_MIN_WIDTH * 2.2 * direction; // ~2 cards at a time
    ref.current.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });
  }

  // Small helper to render a generic “set-style” placeholder card
  function PlaceholderSetCard() {
    return (
      <div
        style={{
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          padding: "0.75rem",
          background: "white",
          minHeight: "160px",
          minWidth: `${CARD_MIN_WIDTH}px`,
          flex: `0 0 ${CARD_MIN_WIDTH}px`,
          scrollSnapAlign: "start",
        }}
      >
        {/* image area */}
        <div
          style={{
            height: "100px",
            borderRadius: "6px",
            background:
              "repeating-linear-gradient(45deg, #eee, #eee 10px, #f8f8f8 10px, #f8f8f8 20px)",
            marginBottom: "0.5rem",
          }}
        />
        {/* title line */}
        <div
          style={{
            height: "0.85rem",
            background: "#eee",
            borderRadius: "999px",
            marginBottom: "0.3rem",
          }}
        />
        {/* subtitle line */}
        <div
          style={{
            height: "0.8rem",
            background: "#f0f0f0",
            borderRadius: "999px",
            width: "70%",
            marginBottom: "0.25rem",
          }}
        />
        {/* small meta line */}
        <div
          style={{
            height: "0.7rem",
            background: "#f5f5f5",
            borderRadius: "999px",
            width: "50%",
          }}
        />
      </div>
    );
  }

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

      {/* FEATURED SETS — grid of cards */}
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
            <PlaceholderSetCard key={n} />
          ))}
        </div>
      </section>

      {/* DEALS & PRICE DROPS — horizontal scroll with cards */}
      <section style={{ marginBottom: "1.75rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.5rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>💸 Deals & price drops</h2>
            <p
              style={{
                color: "#666",
                margin: 0,
                fontSize: "0.9rem",
              }}
            >
              This will show live discounts and price history once we plug in
              data — perfect for affiliate links.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <button
              type="button"
              onClick={() => scrollRow(dealsRowRef, -1)}
              style={{
                borderRadius: "999px",
                border: "1px solid #ddd",
                background: "white",
                padding: "0.25rem 0.5rem",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => scrollRow(dealsRowRef, 1)}
              style={{
                borderRadius: "999px",
                border: "1px solid #ddd",
                background: "white",
                padding: "0.25rem 0.5rem",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              ▶
            </button>

            <Link
              to="/explore"
              style={{
                fontSize: "0.85rem",
                textDecoration: "none",
                color: "#0070f3",
                marginLeft: "0.25rem",
              }}
            >
              View all deals →
            </Link>
          </div>
        </div>

        <div
          ref={dealsRowRef}
          style={{
            marginTop: "0.5rem",
            display: "flex",
            gap: "1rem",
            overflowX: "auto",
            paddingBottom: "0.5rem",
            scrollSnapType: "x mandatory",
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <PlaceholderSetCard key={n} />
          ))}
        </div>
      </section>

      {/* RETIRING SOON — horizontal scroll with cards */}
      <section style={{ marginBottom: "1.75rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.5rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>⏰ Retiring soon</h2>
            <p
              style={{
                color: "#666",
                margin: 0,
                fontSize: "0.9rem",
              }}
            >
              Great for urgency / FOMO and “last chance” buttons with affiliate
              links.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <button
              type="button"
              onClick={() => scrollRow(retiringRowRef, -1)}
              style={{
                borderRadius: "999px",
                border: "1px solid #ddd",
                background: "white",
                padding: "0.25rem 0.5rem",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => scrollRow(retiringRowRef, 1)}
              style={{
                borderRadius: "999px",
                border: "1px solid #ddd",
                background: "white",
                padding: "0.25rem 0.5rem",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              ▶
            </button>
          </div>
        </div>

        <div
          ref={retiringRowRef}
          style={{
            marginTop: "0.5rem",
            display: "flex",
            gap: "1rem",
            overflowX: "auto",
            paddingBottom: "0.5rem",
            scrollSnapType: "x mandatory",
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <PlaceholderSetCard key={n} />
          ))}
        </div>
      </section>

      {/* TRENDING + POPULAR LISTS */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Trending */}
        <div>
          <h2 style={{ marginTop: 0 }}>🔥 Trending now</h2>
          <p style={{ color: "#666", marginTop: 0 }}>
            Most-viewed and most-added sets across the site (later we can drive
            this from real analytics).
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={{ marginBottom: "0.5rem", color: "#555" }}>
              • Placeholder: “Trending Castle set”
            </li>
            <li style={{ marginBottom: "0.5rem", color: "#555" }}>
              • Placeholder: “New Star Wars starfighter”
            </li>
            <li style={{ marginBottom: "0.5rem", color: "#555" }}>
              • Placeholder: “Popular Ideas set”
            </li>
          </ul>
        </div>

        {/* Popular lists — using your real backend data */}
        <div>
          <h2 style={{ marginTop: 0 }}>📋 Popular public lists</h2>
          <p style={{ color: "#666", marginTop: 0 }}>
            Curated lists from the community. Click to see the sets inside.
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
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              {lists.map((list) => (
                <li
                  key={list.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    padding: "0.7rem 0.9rem",
                    background: "white",
                  }}
                >
                  <h3
                    style={{
                      marginTop: 0,
                      marginBottom: "0.2rem",
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
                        marginBottom: "0.2rem",
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
        </div>
      </section>
    </div>
  );
}

export default HomePage;