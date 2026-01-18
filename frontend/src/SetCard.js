// frontend/src/SetCard.js
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddToListMenu from "./AddToListMenu";

/**
 * SmartThumb:
 * - Fixed aspect-ratio thumbnail box (consistent)
 * - Default: contain (no crop) with white bars
 * - If image is "close enough" to the box ratio: use cover (minimal crop)
 * - Optional: very conservative "whitespace zoom" ONLY in contain mode
 */
function SmartThumb({ src, alt, aspect = "16 / 10" }) {
  const [fit, setFit] = useState("contain"); // default no-crop
  const [transform, setTransform] = useState("");
  const lastSrcRef = useRef(null);

  const boxRatio = (() => {
    const parts = String(aspect).split("/").map((x) => Number(x.trim()));
    const a = parts?.[0] || 16;
    const b = parts?.[1] || 10;
    return a / b;
  })();

  useEffect(() => {
    if (lastSrcRef.current !== src) {
      lastSrcRef.current = src;
      setFit("contain");
      setTransform("");
    }
  }, [src]);

  function analyzeAndSet(e) {
    const img = e.currentTarget;
    const w = img.naturalWidth || 1;
    const h = img.naturalHeight || 1;
    const imgRatio = w / h;

    const ratioDiff = Math.abs(imgRatio - boxRatio) / boxRatio;
    const shouldCover = ratioDiff < 0.08;

    setFit(shouldCover ? "cover" : "contain");
    setTransform("");

    if (shouldCover) return;

    try {
      const S = 64;
      const canvas = document.createElement("canvas");
      canvas.width = S;
      canvas.height = S;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(img, 0, 0, S, S);

      const { data } = ctx.getImageData(0, 0, S, S);

      let minX = S,
        minY = S,
        maxX = -1,
        maxY = -1;

      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = (y * S + x) * 4;
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2],
            a = data[i + 3];
          if (a < 20) continue;
          if (r > 245 && g > 245 && b > 245) continue;

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < 0 || maxY < 0) return;

      const bw = (maxX - minX + 1) / S;
      const bh = (maxY - minY + 1) / S;

      if (bw >= 0.78 && bh >= 0.78) return;

      const s = Math.min(1.22, Math.max(1.0, 1 / Math.min(bw, bh)));
      setTransform(`scale(${s})`);
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
      <div
        style={{
          width: "100%",
          aspectRatio: aspect,
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          background: "white", // ✅ white bars if contain
          position: "relative",
        }}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onLoad={analyzeAndSet}
            style={{
              width: "100%",
              height: "100%",
              objectFit: fit,
              objectPosition: "center",
              display: "block",
              background: "white", // ✅ if image has transparency or gaps
              transform: transform || undefined,
              transformOrigin: "center",
              willChange: transform ? "transform" : undefined,
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#9ca3af",
              fontSize: 14,
            }}
          >
            No image
          </div>
        )}
      </div>
    </div>
  );
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return `$${x.toFixed(2)}`;
}

export default function SetCard({
  set,
  token,

  isOwned = false,
  isInWishlist = false,
  onMarkOwned,
  onAddWishlist,

  actionsLayout = "equal",
  variant = "default",
  collectionFooter = "rating",
  userRating,
}) {
  const navigate = useNavigate();
  if (!set) return null;
  
  window.__lastSetCardSet = set;

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
    sale_price, // ✅ new

    user_rating,
  } = set;

  const isCarouselActions = actionsLayout === "carousel";

  const retail = typeof retail_price === "number" ? retail_price : null;
  const sale = typeof sale_price === "number" ? sale_price : null;
  const from =
    typeof price_from === "number" ? price_from : typeof retail_price === "number" ? retail_price : null;

  const hasSale = sale !== null && retail !== null && sale < retail;

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
    height: isCarouselActions ? 28 : 30,
    padding: isCarouselActions ? "0.25rem 0.55rem" : "0.3rem 0.55rem",
    borderRadius: "999px",
    fontSize: isCarouselActions ? "0.8rem" : "0.84rem",
    fontWeight: 650,
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
    flex: isCarouselActions ? "0 0 72px" : "1 1 0",
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
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "white",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        overflow: "hidden",
        minHeight: 300,
      }}
    >
      <SmartThumb src={image_url} alt={name || set_num} aspect="16 / 10" />

      <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", flex: "1 1 auto" }}>
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              fontWeight: 650,
              fontSize: "0.92rem",
              lineHeight: "1.22em",
              minHeight: "2.44em",
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

        {(theme || piecesLabel) && (
          <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 6 }}>
            {theme && (
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{theme}</div>
            )}
            {piecesLabel && <div>{piecesLabel}</div>}
          </div>
        )}

        {(displayAvg !== null || displayCount !== null) && (
          <div style={{ fontSize: 12.5, color: "#4b5563", marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }}>
            <span>⭐</span>
            <span>{displayAvg !== null ? displayAvg.toFixed(1) : "—"}</span>
            {displayCount !== null && <span style={{ color: "#9ca3af" }}>({displayCount})</span>}
          </div>
        )}

        {/* ✅ Option B pricing */}
        {(hasSale || from !== null || retail !== null) && (
          <div style={{ marginBottom: 6, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 800 }}>Price</div>

            {hasSale ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 950, color: "#111827" }}>{money(sale)}</div>
                <div style={{ fontSize: 12.5, color: "#9ca3af", textDecoration: "line-through", fontWeight: 800 }}>
                  {money(retail)}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 900,
                    color: "#111827",
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    padding: "2px 8px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}
                >
                  Save {money(retail - sale)}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13.5, fontWeight: 900, color: "#111827" }}>
                {from !== null ? (price_from != null ? `From ${money(from)}` : money(from)) : "—"}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: "1 1 auto" }} />

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
              <span style={{ fontWeight: 750 }}>
                {effectiveUserRating !== null
                  ? effectiveUserRating.toFixed(1)
                  : displayAvg !== null
                  ? displayAvg.toFixed(1)
                  : "Not rated"}
              </span>
            </div>
          )
        ) : (
          <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 6, paddingTop: 6, display: "flex", gap: 8 }}>
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