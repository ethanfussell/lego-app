// frontend/src/SetCard.js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = "http://localhost:8000";

function SetCard({ set, isOwned, isInWishlist, onMarkOwned, onAddWishlist }) {
  const { set_num, name, year, theme, pieces, image_url } = set;

  // Rating summary state for this card
  const [avgRating, setAvgRating] = useState(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState(null);

  useEffect(() => {
    if (!set_num) return;

    let cancelled = false;

    async function fetchRating() {
      try {
        setRatingLoading(true);
        setRatingError(null);

        const resp = await fetch(
          `${API_BASE}/sets/${encodeURIComponent(set_num)}/rating`
        );

        if (!resp.ok) {
          // 404 = no ratings yet, that's fine
          if (resp.status === 404) {
            if (!cancelled) {
              setAvgRating(null);
              setRatingCount(0);
            }
            return;
          }
          const text = await resp.text();
          throw new Error(`Rating summary failed (${resp.status}): ${text}`);
        }

        const data = await resp.json(); // { set_num, average, count }
        if (!cancelled) {
          setAvgRating(data.average);
          setRatingCount(data.count);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading card rating:", err);
          setRatingError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setRatingLoading(false);
        }
      }
    }

    fetchRating();

    return () => {
      cancelled = true;
    };
  }, [set_num]);

  return (
    <li
      className="set-card"
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        backgroundColor: "#fff",
        listStyle: "none",
        height: "100%",
      }}
    >
      <Link
        to={`/sets/${set_num}`}
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
        }}
      >
        {/* Image area */}
        <div
          style={{
            position: "relative",
            borderRadius: "8px",
            overflow: "hidden",
            width: "100%",
            height: "180px",
          }}
        >
          {image_url ? (
            <img
              src={image_url}
              alt={name || set_num}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                backgroundColor: "#fff",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
                fontSize: "0.9rem",
                backgroundColor: "#fafafa",
              }}
            >
              No image
            </div>
          )}

          {/* Owned / Wishlist badges */}
          {(isOwned || isInWishlist) && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                display: "flex",
                gap: "0.25rem",
              }}
            >
              {isOwned && (
                <span
                  style={{
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    backgroundColor: "#1f883d",
                    color: "#fff",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Owned
                </span>
              )}
              {isInWishlist && (
                <span
                  style={{
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    backgroundColor: "#b16be3",
                    color: "#fff",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Wishlist
                </span>
              )}
            </div>
          )}
        </div>

        {/* Text info */}
        <div style={{ marginTop: "0.5rem" }}>
          <h3
            style={{
              margin: "0 0 0.25rem 0",
              fontSize: "1rem",
            }}
          >
            {name || "Unknown set"}
          </h3>

          <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
            <strong>{set_num}</strong>
            {year && <> · {year}</>}
          </p>

          {theme && (
            <p style={{ margin: 0, color: "#777", fontSize: "0.85rem" }}>
              {theme}
            </p>
          )}

          {pieces && (
            <p style={{ margin: 0, color: "#777", fontSize: "0.85rem" }}>
              {pieces} pieces
            </p>
          )}

          {/* Rating summary line */}
          <p
            style={{
              margin: "0.35rem 0 0 0",
              fontSize: "0.85rem",
              color: "#777",
            }}
          >
            {ratingError
              ? "Rating unavailable"
              : ratingLoading
              ? "Loading rating…"
              : ratingCount === 0
              ? "No ratings yet"
              : `⭐ ${avgRating.toFixed(1)} · ${ratingCount} rating${
                  ratingCount === 1 ? "" : "s"
                }`}
          </p>
        </div>
      </Link>

      {/* Buttons */}
      <div
        style={{
          marginTop: "0.5rem",
          marginBottom: "0.5rem",
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <button
          onClick={() => onMarkOwned(set_num)}
          style={{
            flex: 1,
            padding: "0.4rem 0.6rem",
            borderRadius: "999px",
            border: isOwned ? "none" : "1px solid #ccc",
            backgroundColor: isOwned ? "#1f883d" : "#f5f5f5",
            color: isOwned ? "white" : "#333",
            fontWeight: isOwned ? "600" : "500",
            cursor: "pointer",
          }}
        >
          {isOwned ? "Owned ✓" : "Mark Owned"}
        </button>

        <button
          onClick={() => onAddWishlist(set_num)}
          style={{
            flex: 1,
            padding: "0.4rem 0.6rem",
            borderRadius: "999px",
            border: isInWishlist ? "none" : "1px solid #ccc",
            backgroundColor: isInWishlist ? "#b16be3" : "#f5f5f5",
            color: isInWishlist ? "white" : "#333",
            fontWeight: isInWishlist ? "600" : "500",
            cursor: "pointer",
          }}
        >
          {isInWishlist ? "In Wishlist ★" : "Add to Wishlist"}
        </button>
      </div>
    </li>
  );
}

export default SetCard;