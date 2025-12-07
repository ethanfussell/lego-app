// src/SetCard.js
import React from "react";
import { Link } from "react-router-dom";

function SetCard({ set, isOwned, isInWishlist, onMarkOwned, onAddWishlist }) {
  return (
    <li
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        height: "100%",
      }}
    >
      <Link
        to={`/sets/${set.set_num}`}
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "block",
        }}
      >
        {/* Uniform image container */}
        <div
            style={{
                width: "100%",
                aspectRatio: "4 / 3",
                borderRadius: "4px",
                background: "#white",
                marginBottom: "0.4rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}
            >
            {set.image_url ? (
                <img
                src={set.image_url}
                alt={set.name || set.set_num}
                style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    display: "block",
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
                fontSize: "0.8rem",
                color: "#999",
              }}
            >
              No image
            </div>
          )}
        </div>

        <div>
          <h3
            style={{
              margin: "0 0 0.25rem 0",
              fontSize: "1rem",
            }}
          >
            {set.name || "Unknown set"}
          </h3>
          <p style={{ margin: 0, color: "#555" }}>
            <strong>{set.set_num}</strong>
            {set.year && <> · {set.year}</>}
          </p>
          {set.theme && (
            <p style={{ margin: 0, color: "#777" }}>{set.theme}</p>
          )}
          {set.pieces && (
            <p style={{ margin: 0, color: "#777" }}>
              {set.pieces} pieces
            </p>
          )}
        </div>
      </Link>

      {/* Owned / Wishlist buttons (toggle, not disabled) */}
      <div
        style={{
          marginTop: "0.5rem",
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <button
          onClick={() => onMarkOwned(set.set_num)}
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
          onClick={() => onAddWishlist(set.set_num)}
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