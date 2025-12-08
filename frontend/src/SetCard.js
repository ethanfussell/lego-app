// src/SetCard.js
import React from "react";
import { useNavigate } from "react-router-dom";

const cardStyle = {
  border: "1px solid #ddd",
  borderRadius: "10px",
  overflow: "hidden",
  background: "white",
  display: "flex",
  flexDirection: "column",
  cursor: "pointer",
  transition: "box-shadow 0.15s ease, transform 0.15s ease",
};

const cardHoverStyle = {
  boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
  transform: "translateY(-2px)",
};

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return `$${Number(value).toFixed(2)}`;
}

function SetCard({
  set,
  isOwned = false,
  isInWishlist = false,
  onMarkOwned,
  onAddWishlist,
  variant = "default",
}) {
  const navigate = useNavigate();
  const [hover, setHover] = React.useState(false);

  if (!set) return null;

  const {
    set_num,
    name,
    year,
    theme,
    pieces,
    image_url,
    retail_price,
    current_price,
    discount_percent,
  } = set;

  const hasPrice = current_price != null || retail_price != null;
  const displayCurrent = formatPrice(current_price);
  const displayRetail = formatPrice(retail_price);
  const displayDiscount =
    discount_percent != null ? `${discount_percent}% off` : null;

  const handleCardClick = () => {
    if (!set_num) return;
    navigate(`/sets/${encodeURIComponent(set_num)}`);
  };

  const handleOwnedClick = (e) => {
    e.stopPropagation(); // don't trigger card navigation
    if (onMarkOwned && set_num) {
      onMarkOwned(set_num);
    }
  };

  const handleWishlistClick = (e) => {
    e.stopPropagation(); // don't trigger card navigation
    if (onAddWishlist && set_num) {
      onAddWishlist(set_num);
    }
  };

  const combinedStyle = hover
    ? { ...cardStyle, ...cardHoverStyle }
    : cardStyle;

  return (
    <div
      style={combinedStyle}
      onClick={handleCardClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Image */}
      <div
        style={{
          width: "100%",
          paddingTop: "65%",
          position: "relative",
          background: "#f5f5f5",
        }}
      >
        {image_url ? (
          <img
            src={image_url}
            alt={name || set_num}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.85rem",
              color: "#888",
            }}
          >
            No image
          </div>
        )}

        {/* Badge area (e.g., Owned / Wishlist pill) */}
        {(isOwned || isInWishlist) && (
          <div
            style={{
              position: "absolute",
              top: "0.4rem",
              left: "0.4rem",
              display: "flex",
              gap: "0.25rem",
            }}
          >
            {isOwned && (
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "999px",
                  background: "rgba(31, 136, 61, 0.9)",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Owned
              </span>
            )}
            {isInWishlist && (
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "999px",
                  background: "rgba(177, 107, 227, 0.9)",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Wishlist
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "0.6rem 0.7rem 0.7rem 0.7rem", flex: "1 1 auto" }}>
        {/* Title */}
        <div style={{ marginBottom: "0.35rem" }}>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              lineHeight: 1.2,
              marginBottom: "0.1rem",
            }}
          >
            {name || "Unknown set"}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#666" }}>
            {set_num}
            {year && <> · {year}</>}
          </div>
        </div>

        {/* Meta row: theme / pieces */}
        <div
          style={{
            fontSize: "0.78rem",
            color: "#777",
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
            marginBottom: "0.35rem",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {theme}
          </span>
          {pieces && <span>{pieces} pcs</span>}
        </div>

        {/* Price row */}
        {hasPrice && (
          <div
            style={{
              fontSize: "0.8rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "0.4rem",
              gap: "0.4rem",
            }}
          >
            <div>
              {displayCurrent && (
                <span style={{ fontWeight: 600 }}>{displayCurrent}</span>
              )}
              {displayRetail && displayCurrent && displayRetail !== displayCurrent && (
                <span
                  style={{
                    marginLeft: "0.3rem",
                    textDecoration: "line-through",
                    color: "#999",
                    fontSize: "0.75rem",
                  }}
                >
                  {displayRetail}
                </span>
              )}
            </div>
            {displayDiscount && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#b12704",
                  fontWeight: 600,
                }}
              >
                {displayDiscount}
              </span>
            )}
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: "0.4rem",
            marginTop: "0.3rem",
          }}
        >
          <button
            type="button"
            onClick={handleOwnedClick}
            style={{
              flex: 1,
              padding: "0.25rem 0.4rem",
              borderRadius: "999px",
              border: isOwned ? "1px solid #1f883d" : "1px solid #ccc",
              backgroundColor: isOwned ? "#1f883d" : "white",
              color: isOwned ? "white" : "#222",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {isOwned ? "Owned ✓" : "Mark owned"}
          </button>

          <button
            type="button"
            onClick={handleWishlistClick}
            style={{
              flex: 1,
              padding: "0.25rem 0.4rem",
              borderRadius: "999px",
              border: isInWishlist ? "1px solid #b16be3" : "1px solid #ccc",
              backgroundColor: isInWishlist ? "#b16be3" : "white",
              color: isInWishlist ? "white" : "#222",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {isInWishlist ? "In wishlist ★" : "Wishlist"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SetCard;