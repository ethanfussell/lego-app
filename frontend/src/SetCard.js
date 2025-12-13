// src/SetCard.js
import React from "react";
import { useNavigate } from "react-router-dom";

function SetCard({
  set,
  isOwned = false,
  isInWishlist = false,
  onMarkOwned,
  onAddWishlist,
  variant = "default", // "default" | "sale" | "collection" (future)
  userRating,
}) {
  const navigate = useNavigate();
  if (!set) return null;

  const {
    set_num,
    name,
    year,
    theme,
    pieces,
    image_url,
    status,
    is_retired,
    retired,
    average_rating,
    rating_count,
    price_from,
    retail_price,
    user_rating,
  } = set;

  // ---- price ----
  const priceFrom =
    typeof price_from === "number"
      ? price_from
      : typeof retail_price === "number"
      ? retail_price
      : null;

  // ---- derived flags / ratings ----
  const isRetiredFlag =
    status === "retired" || is_retired === true || retired === true;

  const displayAvg =
    typeof average_rating === "number" ? average_rating : null;
  const displayCount =
    typeof rating_count === "number" ? rating_count : null;

  const effectiveUserRating =
    typeof userRating === "number"
      ? userRating
      : typeof user_rating === "number"
      ? user_rating
      : null;

  // ---- handlers ----
  function handleCardClick() {
    if (!set_num) return;
    navigate(`/sets/${encodeURIComponent(set_num)}`);
  }

  function handleOwnedClick(e) {
    e.stopPropagation();
    if (typeof onMarkOwned === "function") {
      onMarkOwned(set_num);
    }
  }

  function handleWishlistClick(e) {
    e.stopPropagation();
    if (typeof onAddWishlist === "function") {
      onAddWishlist(set_num);
    }
  }

  return (
    <div
      onClick={handleCardClick}
      style={{
        width: "100%",
        maxWidth: "260px",
        minHeight: "360px", // 👈 cards all at least this tall
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        background: "white",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "transform 0.1s ease, box-shadow 0.1s ease",
        overflow: "hidden", // nothing escapes the card
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          "0 6px 16px rgba(15,23,42,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow =
          "0 1px 2px rgba(15,23,42,0.04)";
      }}
    >
      {/* IMAGE AREA */}
      <div
        style={{
          padding: "0.75rem",
          borderBottom: "1px solid #f3f4f6",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            margin: "0 auto",
            borderRadius: "10px",
            background: "white",
            border: "1px solid #e5e7eb",
            padding: "0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "200px", // 👈 fixed photo-frame height
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {image_url ? (
            <img
              src={image_url}
              alt={name || set_num}
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
                borderRadius: "8px",
                background:
                  "repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 10px, #ffffff 10px, #ffffff 20px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
                fontSize: "0.85rem",
              }}
            >
              No image
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div
        style={{
          padding: "0.6rem 0.75rem 0.8rem 0.75rem",
          display: "flex",
          flexDirection: "column",
          flex: "1 1 auto",
        }}
      >
        {/* Title */}
        <div style={{ marginBottom: "0.3rem" }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.95rem",
              lineHeight: 1.25,
              color: "#111827",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {name || "Unknown set"}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#6b7280",
              marginTop: "0.15rem",
            }}
          >
            <strong>{set_num}</strong>
            {year && <> · {year}</>}
          </div>
        </div>

        {/* Meta */}
        {(theme || pieces || isRetiredFlag) && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#6b7280",
              marginBottom: "0.35rem",
            }}
          >
            {theme && (
              <div
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {theme}
              </div>
            )}
            {pieces && <div>{pieces} pieces</div>}
            {isRetiredFlag && <div>⏳ Retired</div>}
          </div>
        )}

        {/* Rating summary */}
        {(displayAvg !== null || displayCount !== null) && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#4b5563",
              marginBottom: "0.35rem",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <span>⭐</span>
            <span>{displayAvg !== null ? displayAvg.toFixed(1) : "—"}</span>
            {displayCount !== null && (
              <span style={{ color: "#9ca3af" }}>
                ({displayCount} rating{displayCount === 1 ? "" : "s"})
              </span>
            )}
          </div>
        )}

        {/* Price line (used on Sale but harmless elsewhere) */}
        {priceFrom !== null && (
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: variant === "sale" ? "#16a34a" : "#111827",
              marginBottom: "0.4rem",
            }}
          >
            From ${priceFrom.toFixed(2)}
          </div>
        )}

        {/* Push footer to bottom */}
        <div style={{ flex: "1 1 auto" }} />

        {/* FOOTER VARIANTS */}
        {variant === "collection" ? (
          <div
            style={{
              borderTop: "1px solid #f3f4f6",
              paddingTop: "0.4rem",
              marginTop: "0.35rem",
              fontSize: "0.8rem",
              color: "#4b5563",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <span style={{ color: "#6b7280" }}>Your rating</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <span style={{ fontSize: "0.95rem", color: "#f59e0b" }}>★</span>
              <span>
                {effectiveUserRating !== null
                  ? effectiveUserRating.toFixed(1)
                  : displayAvg !== null
                  ? displayAvg.toFixed(1)
                  : "Not rated"}
              </span>
            </div>
          </div>
        ) : (
          // default & sale both use the same two buttons for now
          <div
            style={{
              borderTop: "1px solid #f3f4f6",
              marginTop: "0.4rem",
              paddingTop: "0.4rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.35rem",
            }}
          >
            <button
              type="button"
              onClick={handleOwnedClick}
              style={{
                flex: "1 1 auto",
                padding: "0.35rem 0.5rem",
                borderRadius: "999px",
                border: isOwned ? "none" : "1px solid #d1d5db",
                backgroundColor: isOwned ? "#16a34a" : "#f9fafb",
                color: isOwned ? "white" : "#111827",
                fontSize: "0.8rem",
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isOwned ? "Owned ✓" : "Mark owned"}
            </button>

            <button
              type="button"
              onClick={handleWishlistClick}
              style={{
                flex: "1 1 auto",
                padding: "0.35rem 0.5rem",
                borderRadius: "999px",
                border: isInWishlist ? "none" : "1px solid #d1d5db",
                backgroundColor: isInWishlist ? "#a855f7" : "#f9fafb",
                color: isInWishlist ? "white" : "#111827",
                fontSize: "0.8rem",
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isInWishlist ? "In wishlist ★" : "Wishlist"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetCard;