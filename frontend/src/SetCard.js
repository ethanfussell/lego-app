// frontend/src/SetCard.js
import React from "react";
import { Link } from "react-router-dom";

function formatPrice(value) {
  if (value == null || Number.isNaN(value)) return null;
  return `$${value.toFixed(2)}`;
}

function SetCard({
  set,
  isOwned = false,
  isInWishlist = false,
  onMarkOwned,
  onAddWishlist,
  variant = "default", // "default" | "dealRow"
}) {
  const {
    set_num,
    name,
    year,
    theme,
    pieces,
    image_url,
    // optional pricing fields (safe even if backend doesn't send them yet)
    msrp,
    lowest_price,
    best_retailer,
  } = set;

  const normalizedMsrp =
    typeof msrp === "number" && !Number.isNaN(msrp) ? msrp : null;
  const normalizedLowest =
    typeof lowest_price === "number" && !Number.isNaN(lowest_price)
      ? lowest_price
      : null;

  const currentPrice = normalizedLowest ?? normalizedMsrp;

  let discountPercent = null;
  if (
    normalizedMsrp != null &&
    normalizedLowest != null &&
    normalizedLowest < normalizedMsrp
  ) {
    discountPercent = Math.round(
      ((normalizedMsrp - normalizedLowest) / normalizedMsrp) * 100
    );
  }

  const retailerLabel = best_retailer || null;

  const cardBaseStyle = {
    border: "1px solid #ddd",
    borderRadius: "10px",
    padding: "0.75rem",
    display: "flex",
    flexDirection: "column",
    background: "white",
    height: "100%",
    boxSizing: "border-box",
  };

  const imageWrapperStyle = {
    width: "100%",
    aspectRatio: "4 / 3",
    borderRadius: "8px",
    overflow: "hidden",
    marginBottom: "0.5rem",
    background: "#f5f5f5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const imageStyle = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };

  const titleStyle = {
    margin: "0 0 0.15rem 0",
    fontSize: "0.98rem",
    fontWeight: 600,
  };

  const metaStyle = {
    margin: 0,
    fontSize: "0.8rem",
    color: "#666",
  };

  // =========================
  // DEAL-ROW VARIANT (home page)
  // =========================
  if (variant === "dealRow") {
    return (
      <li style={cardBaseStyle}>
        <div style={imageWrapperStyle}>
          {image_url ? (
            <img src={image_url} alt={name || set_num} style={imageStyle} />
          ) : (
            <span style={{ fontSize: "0.8rem", color: "#999" }}>
              No image
            </span>
          )}
        </div>

        <h3 style={titleStyle}>
          <Link
            to={`/sets/${set_num}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            {name || "Unknown set"}
          </Link>
        </h3>

        <p style={metaStyle}>
          <strong>{set_num}</strong>
          {year && <> · {year}</>}
        </p>

        {theme && (
          <p style={{ ...metaStyle, marginTop: "0.15rem" }}>{theme}</p>
        )}

        {/* Pricing focus */}
        <div
          style={{
            marginTop: "0.4rem",
            display: "flex",
            alignItems: "baseline",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          {currentPrice != null ? (
            <span
              style={{
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              {formatPrice(currentPrice)}
            </span>
          ) : (
            <span
              style={{
                fontSize: "0.85rem",
                color: "#777",
              }}
            >
              Price coming soon
            </span>
          )}

          {discountPercent != null && discountPercent >= 5 && (
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                padding: "0.1rem 0.4rem",
                borderRadius: "999px",
                backgroundColor: "#1f883d",
                color: "white",
              }}
            >
              {discountPercent}% off
            </span>
          )}
        </div>

        {normalizedMsrp != null && currentPrice != null && currentPrice !== normalizedMsrp && (
          <p
            style={{
              ...metaStyle,
              marginTop: "0.15rem",
              textDecoration: "line-through",
            }}
          >
            {formatPrice(normalizedMsrp)} MSRP
          </p>
        )}

        {retailerLabel && (
          <p style={{ ...metaStyle, marginTop: "0.15rem" }}>
            From {retailerLabel}
          </p>
        )}

        {/* Spacer + CTA */}
        <div style={{ marginTop: "auto" }} />

        <Link
          to={`/sets/${set_num}`}
          style={{
            marginTop: "0.6rem",
            padding: "0.4rem 0.7rem",
            borderRadius: "999px",
            border: "1px solid #222",
            textDecoration: "none",
            fontSize: "0.85rem",
            textAlign: "center",
          }}
        >
          View prices →
        </Link>
      </li>
    );
  }

  // =========================
  // DEFAULT VARIANT (search / normal grid)
  // =========================
  return (
    <li style={cardBaseStyle}>
      <div style={imageWrapperStyle}>
        {image_url ? (
          <img src={image_url} alt={name || set_num} style={imageStyle} />
        ) : (
          <span style={{ fontSize: "0.8rem", color: "#999" }}>No image</span>
        )}
      </div>

      <h3 style={titleStyle}>
        <Link
          to={`/sets/${set_num}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          {name || "Unknown set"}
        </Link>
      </h3>

      <p style={metaStyle}>
        <strong>{set_num}</strong>
        {year && <> · {year}</>}
      </p>

      {theme && (
        <p style={{ ...metaStyle, marginTop: "0.15rem" }}>{theme}</p>
      )}

      {pieces && (
        <p style={{ ...metaStyle, marginTop: "0.15rem" }}>
          {pieces} pieces
        </p>
      )}

      {/* Small price line (optional) */}
      {currentPrice != null && (
        <p
          style={{
            marginTop: "0.35rem",
            fontSize: "0.85rem",
            color: "#444",
          }}
        >
          {formatPrice(currentPrice)}
          {discountPercent != null && discountPercent >= 5 && (
            <>
              {" "}
              ·{" "}
              <span style={{ color: "#1f883d", fontWeight: 600 }}>
                {discountPercent}% off
              </span>
            </>
          )}
          {retailerLabel && <> · via {retailerLabel}</>}
        </p>
      )}

      {/* Spacer to push buttons down */}
      <div style={{ flexGrow: 1 }} />

      {/* Owned / wishlist buttons */}
      <div
        style={{
          marginTop: "0.6rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
        }}
      >
        {typeof onMarkOwned === "function" && (
          <button
            onClick={() => onMarkOwned(set_num)}
            style={{
              padding: "0.4rem 0.7rem",
              borderRadius: "999px",
              border: isOwned ? "none" : "1px solid #ccc",
              backgroundColor: isOwned ? "#1f883d" : "#f5f5f5",
              color: isOwned ? "white" : "#222",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {isOwned ? "Owned ✓" : "Mark Owned"}
          </button>
        )}

        {typeof onAddWishlist === "function" && (
          <button
            onClick={() => onAddWishlist(set_num)}
            style={{
              padding: "0.4rem 0.7rem",
              borderRadius: "999px",
              border: isInWishlist ? "none" : "1px solid #ccc",
              backgroundColor: isInWishlist ? "#b16be3" : "#f5f5f5",
              color: isInWishlist ? "white" : "#222",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {isInWishlist ? "In Wishlist ★" : "Add to Wishlist"}
          </button>
        )}

        <Link
          to={`/sets/${set_num}`}
          style={{
            marginTop: "0.1rem",
            fontSize: "0.8rem",
            color: "#555",
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          View details →
        </Link>
      </div>
    </li>
  );
}

export default SetCard;