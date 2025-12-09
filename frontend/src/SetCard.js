// src/SetCard.js
import React from "react";
import { useNavigate } from "react-router-dom";

function SetCard({
  set,
  isOwned = false,
  isInWishlist = false,
  onMarkOwned,
  onAddWishlist,
  variant = "default",
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
    rating,
    user_rating,
    my_rating,
  } = set;

  // Try to pick a "user-ish" rating value
  const displayRating =
    typeof user_rating === "number"
      ? user_rating
      : typeof my_rating === "number"
      ? my_rating
      : typeof rating === "number"
      ? rating
      : null;

  function handleCardClick() {
    if (!set_num) return;
    navigate(`/sets/${encodeURIComponent(set_num)}`);
  }

  const cardPadding = "0.75rem";

  return (
    <div
      onClick={handleCardClick}
      style={{
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        backgroundColor: "white",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        height: "100%",
      }}
    >
      {/* IMAGE */}
      <div
        style={{
          borderBottom: "1px solid #f3f4f6",
          padding: cardPadding,
          paddingBottom: "0.5rem",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "160px",
            borderRadius: "10px",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
                background:
                  "repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 10px,#e5e7eb 10px,#e5e7eb 20px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.8rem",
                color: "#9ca3af",
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
          padding: cardPadding,
          paddingTop: "0.55rem",
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Title */}
        <div style={{ marginBottom: "0.35rem" }}>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              lineHeight: 1.2,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {name || "Unknown set"}
          </div>
          <div
            style={{
              marginTop: "0.15rem",
              fontSize: "0.8rem",
              color: "#6b7280",
            }}
          >
            <span>{set_num}</span>
            {year && <span> · {year}</span>}
          </div>
        </div>

        {/* Meta line */}
        {(theme || pieces) && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#6b7280",
              marginBottom: "0.4rem",
            }}
          >
            {theme && <span>{theme}</span>}
            {theme && pieces && <span> · </span>}
            {pieces && <span>{pieces} pcs</span>}
          </div>
        )}

        {/* Rating pill */}
        {displayRating != null && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#f59e0b",
              marginBottom: "0.4rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <span>★</span>
            <span>{displayRating.toFixed(1)}</span>
          </div>
        )}

        {/* Spacer pushes footer to bottom */}
        <div style={{ flexGrow: 1 }} />

        {/* FOOTER / ACTIONS */}
        <div style={{ marginTop: "0.5rem" }}>
          {variant === "collection" ? (
            /* COLLECTION VARIANT: just user's rating */
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.8rem",
                color: "#4b5563",
              }}
            >
              <span>Your rating</span>
              {displayRating != null ? (
                <div
                  style={{
                    position: "relative",
                    display: "inline-block",
                    fontSize: "1.2rem",
                    lineHeight: 1,
                  }}
                >
                  <div style={{ color: "#e5e7eb" }}>★★★★★</div>
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      color: "#f59e0b",
                      width: `${
                        (Math.min(Math.max(displayRating, 0), 5) / 5) * 100
                      }%`,
                      pointerEvents: "none",
                    }}
                  >
                    ★★★★★
                  </div>
                </div>
              ) : (
                <span style={{ color: "#9ca3af" }}>Not rated yet</span>
              )}
            </div>
          ) : variant === "home" || variant === "dealRow" ? (
            /* HOME / DEALS VARIANT: Shop now */
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
              style={{
                width: "100%",
                padding: "0.4rem 0.75rem",
                borderRadius: "999px",
                border: "none",
                backgroundColor: "#111827",
                color: "white",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Shop now →
            </button>
          ) : (
            /* DEFAULT VARIANT: Owned / Wishlist buttons */
            <div
              style={{
                display: "flex",
                gap: "0.4rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkOwned && onMarkOwned(set_num);
                }}
                style={{
                  padding: "0.3rem 0.7rem",
                  borderRadius: "999px",
                  border: isOwned ? "none" : "1px solid #d1d5db",
                  backgroundColor: isOwned ? "#16a34a" : "#f9fafb",
                  color: isOwned ? "white" : "#111827",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {isOwned ? "Owned ✓" : "Mark Owned"}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddWishlist && onAddWishlist(set_num);
                }}
                style={{
                  padding: "0.3rem 0.7rem",
                  borderRadius: "999px",
                  border: isInWishlist ? "none" : "1px solid #d1d5db",
                  backgroundColor: isInWishlist ? "#a855f7" : "#f9fafb",
                  color: isInWishlist ? "white" : "#111827",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {isInWishlist ? "In Wishlist ★" : "Wishlist"}
              </button>

              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "0.8rem",
                  color: "#6b7280",
                }}
              >
                View details →
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SetCard;