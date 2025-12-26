// src/SetCard.js
import React from "react";
import { useNavigate } from "react-router-dom";
import AddToListMenu from "./AddToListMenu";

function SetCard({
  set,
  isOwned = false,
  isInWishlist = false,
  onMarkOwned,
  onAddWishlist,
  variant = "default",
  userRating,
  collectionFooter = "rating",
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

  const priceFrom =
    typeof price_from === "number"
      ? price_from
      : typeof retail_price === "number"
      ? retail_price
      : null;

  const isRetiredFlag =
    status === "retired" || is_retired === true || retired === true;

  const displayAvg = typeof average_rating === "number" ? average_rating : null;
  const displayCount = typeof rating_count === "number" ? rating_count : null;

  const effectiveUserRating =
    typeof userRating === "number"
      ? userRating
      : typeof user_rating === "number"
      ? user_rating
      : null;

  function handleCardClick() {
    if (!set_num) return;
    navigate(`/sets/${encodeURIComponent(set_num)}`);
  }

  function handleShopClick(e) {
    e.stopPropagation();
    navigate(`/sets/${encodeURIComponent(set_num)}#shop`);
  }

  // shared button base
  const actionBtnBase = {
    height: 32,
    padding: "0.35rem 0.5rem",
    borderRadius: "999px",
    fontSize: "0.85rem",
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111827",
  };

  // key change: make Shop a fixed small pill; let Add-to-list fill remaining space
  const shopBtnStyle = {
    ...actionBtnBase,
    flex: "0 0 76px",
    width: 76,
    minWidth: 76,
  };

  const addWrapStyle = { flex: "1 1 auto", minWidth: 0 };

  const addBtnStyle = {
    ...actionBtnBase,
    width: "100%",
    minWidth: 0,
    justifyContent: "space-between",
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        width: "100%",
        maxWidth: "260px",
        height: "100%",          // ✅ lets parent stretch it
        minHeight: "360px",      // ✅ keeps a baseline
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        background: "white",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(15,23,42,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,0.04)";
      }}
    >
      {/* IMAGE */}
      <div style={{ padding: "0.75rem", borderBottom: "1px solid #f3f4f6" }}>
        <div
          style={{
            width: "100%",
            borderRadius: "10px",
            background: "white",
            border: "1px solid #e5e7eb",
            padding: "0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "200px",
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
            minHeight: "2.5em",     // ✅ always takes 2 lines (2 * 1.25 = 2.5em)
            color: "#111827",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {name || "Unknown set"}
        </div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.15rem" }}>
            <strong>{set_num}</strong>
            {year && <> · {year}</>}
          </div>
        </div>

        {/* Meta */}
        {(theme || pieces || isRetiredFlag) && (
          <div style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.35rem" }}>
            {theme && (
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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

        <div style={{ flex: "1 1 auto" }} />

        {/* FOOTER */}
        {variant === "collection" ? (
          collectionFooter === "shop" ? (
            <div style={{ borderTop: "1px solid #f3f4f6", marginTop: "0.4rem", paddingTop: "0.4rem" }}>
              <button type="button" onClick={handleShopClick} style={{ ...actionBtnBase, width: "100%" }}>
                Shop
              </button>
            </div>
          ) : (
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
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
          )
        ) : (
          <div
            style={{
              borderTop: "1px solid #f3f4f6",
              marginTop: "0.4rem",
              paddingTop: "0.4rem",
              display: "flex",
              gap: "0.35rem",
              alignItems: "center",
            }}
          >
            <button type="button" onClick={handleShopClick} style={shopBtnStyle}>
              Shop
            </button>

            <div style={addWrapStyle}>
              <AddToListMenu
                setNum={set_num}
                includeOwned={true}
                includeWishlist={true}
                ownedSelected={isOwned}
                wishlistSelected={isInWishlist}
                onAddOwned={() => onMarkOwned?.(set_num)}
                onRemoveOwned={() => onMarkOwned?.(set_num)}
                onAddWishlist={() => onAddWishlist?.(set_num)}
                onRemoveWishlist={() => onAddWishlist?.(set_num)}
                buttonLabel="Add to list"
                buttonStyle={addBtnStyle}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetCard;