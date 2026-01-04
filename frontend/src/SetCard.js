// frontend/src/SetCard.js
import React from "react";
import { useNavigate } from "react-router-dom";
import AddToListMenu from "./AddToListMenu";

export default function SetCard({
  set,
  token, // optional: pass through to AddToListMenu if you want

  isOwned = false,
  isInWishlist = false,
  onMarkOwned,
  onAddWishlist,

  // "equal" (grid): Shop and Add share space
  // "carousel": Shop smaller, Add larger
  actionsLayout = "equal",

  // optional: changes bottom layout for collection pages
  variant = "default",
  collectionFooter = "rating", // "rating" or "shop"
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
    average_rating,
    rating_count,
    price_from,
    retail_price,
    user_rating,
  } = set;

  const isCarouselActions = actionsLayout === "carousel";

  const priceFrom =
    typeof price_from === "number"
      ? price_from
      : typeof retail_price === "number"
      ? retail_price
      : null;

  const displayAvg = typeof average_rating === "number" ? average_rating : null;
  const displayCount = typeof rating_count === "number" ? rating_count : null;

  const effectiveUserRating =
    typeof userRating === "number"
      ? userRating
      : typeof user_rating === "number"
      ? user_rating
      : null;

  const piecesLabel =
    typeof pieces === "number"
      ? `${pieces.toLocaleString()} pieces`
      : typeof pieces === "string" && pieces.trim()
      ? `${pieces.trim()} pieces`
      : null;

  function goToSet() {
    if (!set_num) return;
    navigate(`/sets/${encodeURIComponent(set_num)}`);
  }

  function goToShop(e) {
    e.stopPropagation();
    if (!set_num) return;
    navigate(`/sets/${encodeURIComponent(set_num)}#shop`);
  }

  const actionBtnBase = {
    height: isCarouselActions ? 28 : 32,
    padding: isCarouselActions ? "0.25rem 0.55rem" : "0.35rem 0.6rem",
    borderRadius: "999px",
    fontSize: isCarouselActions ? "0.8rem" : "0.85rem",
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
    cursor: "pointer",
  };

  const shopBtnStyle = {
    ...actionBtnBase,
    flex: isCarouselActions ? "0 0 70px" : "1 1 0",
  };

  const addWrapStyle = { flex: "1 1 0", minWidth: 124, display: "flex" };

  const addBtnStyle = {
    ...actionBtnBase,
    width: "100%",
    flex: "1 1 0",
  };

  return (
    <div
      onClick={goToSet}
      style={{
        width: "100%",
        minHeight: 360,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "white",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      {/* Image */}
      <div style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
        <div
          style={{
            height: 200,
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            background: "white",
          }}
        >
          {image_url ? (
            <img
              src={image_url}
              alt={name || set_num}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          ) : (
            <div style={{ color: "#9ca3af", fontSize: 14 }}>No image</div>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          padding: "10px 12px 12px",
          display: "flex",
          flexDirection: "column",
          flex: "1 1 auto",
        }}
      >
        {/* Title + meta */}
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.95rem",
              lineHeight: "1.25em",
              minHeight: "2.5em", // reserve 2 lines
              color: "#111827",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {name || "Unknown set"}
          </div>

          <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2 }}>
            <strong>{set_num}</strong>
            {year ? <> · {year}</> : null}
          </div>
        </div>

        {/* Theme + Pieces */}
        {(theme || piecesLabel) && (
          <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 6 }}>
            {theme && (
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {theme}
              </div>
            )}
            {piecesLabel && <div>{piecesLabel}</div>}
          </div>
        )}

        {/* Rating */}
        {(displayAvg !== null || displayCount !== null) && (
          <div
            style={{
              fontSize: 12.5,
              color: "#4b5563",
              marginBottom: 6,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span>⭐</span>
            <span>{displayAvg !== null ? displayAvg.toFixed(1) : "—"}</span>
            {displayCount !== null && <span style={{ color: "#9ca3af" }}>({displayCount})</span>}
          </div>
        )}

        {/* Price */}
        {priceFrom !== null && (
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
            From ${priceFrom.toFixed(2)}
          </div>
        )}

        <div style={{ flex: "1 1 auto" }} />

        {/* Footer */}
        {variant === "collection" ? (
          collectionFooter === "shop" ? (
            <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 6, paddingTop: 6 }}>
              <button type="button" onClick={goToShop} style={{ ...actionBtnBase, width: "100%" }}>
                Shop
              </button>
            </div>
          ) : (
            <div
              style={{
                borderTop: "1px solid #f3f4f6",
                paddingTop: 6,
                marginTop: 6,
                fontSize: 12.5,
                color: "#4b5563",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "#6b7280" }}>Your rating</span>
              <span style={{ fontWeight: 700 }}>
                {effectiveUserRating !== null
                  ? effectiveUserRating.toFixed(1)
                  : displayAvg !== null
                  ? displayAvg.toFixed(1)
                  : "Not rated"}
              </span>
            </div>
          )
        ) : (
          <div
            style={{
              borderTop: "1px solid #f3f4f6",
              marginTop: 6,
              paddingTop: 6,
              display: "flex",
              gap: 8,
            }}
          >
            <button type="button" onClick={goToShop} style={shopBtnStyle}>
              Shop
            </button>

            <div style={addWrapStyle}>
              <AddToListMenu
                token={token}
                setNum={set_num}
                includeOwned
                includeWishlist
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