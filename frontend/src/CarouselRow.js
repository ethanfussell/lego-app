import React, { useMemo, useRef } from "react";
import { Link } from "react-router-dom";

/**
 * CarouselRow
 * - Horizontal scroll works with trackpad naturally
 * - Click+drag works on desktop
 * - Optional ◀ ▶ buttons scroll by ~one viewport
 */
export default function CarouselRow({
  title,
  subtitle,     // e.g. "Private • 42 sets" or "Public • 12 sets"
  viewHref,     // e.g. "/collections/owned" or `/lists/${id}`
  emptyText = "No sets yet.",
  children,     // <li> cards
}) {
  const scrollerRef = useRef(null);

  const drag = useRef({
    isDown: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  function scrollByPage(dir) {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.9));
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  function onMouseDown(e) {
    const el = scrollerRef.current;
    if (!el) return;

    drag.current.isDown = true;
    drag.current.moved = false;
    drag.current.startX = e.pageX;
    drag.current.startScrollLeft = el.scrollLeft;

    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  }

  function onMouseLeave() {
    const el = scrollerRef.current;
    if (!el) return;
    drag.current.isDown = false;
    el.style.cursor = "grab";
    el.style.userSelect = "";
  }

  function onMouseUp() {
    const el = scrollerRef.current;
    if (!el) return;
    drag.current.isDown = false;
    el.style.cursor = "grab";
    el.style.userSelect = "";
  }

  function onMouseMove(e) {
    const el = scrollerRef.current;
    if (!el) return;
    if (!drag.current.isDown) return;

    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;

    el.scrollLeft = drag.current.startScrollLeft - dx;
  }

  // Prevent “clicking into a card” when user was dragging
  function onClickCapture(e) {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }

  const hasItems = useMemo(() => {
    // children can be array or single
    if (!children) return false;
    if (Array.isArray(children)) return children.length > 0;
    return true;
  }, [children]);

  return (
    <section
      style={{
        border: "1px solid #eee",
        borderRadius: 16,
        padding: "0.85rem",
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
            {subtitle ? <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>{subtitle}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => scrollByPage(-1)}
            aria-label="Scroll left"
            style={navBtnStyle}
            type="button"
          >
            ◀
          </button>
          <button
            onClick={() => scrollByPage(1)}
            aria-label="Scroll right"
            style={navBtnStyle}
            type="button"
          >
            ▶
          </button>

          {viewHref ? (
            <Link to={viewHref} style={{ color: "#111", fontWeight: 700, textDecoration: "none" }}>
              View →
            </Link>
          ) : null}
        </div>
      </div>

      {!hasItems ? (
        <div style={{ color: "#6b7280", padding: "0.25rem 0.1rem" }}>{emptyText}</div>
      ) : (
        <div
          ref={scrollerRef}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onMouseMove={onMouseMove}
          onClickCapture={onClickCapture}
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            display: "flex",
            gap: 12,
            paddingBottom: 6,
            cursor: "grab",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

const navBtnStyle = {
  padding: "0.25rem 0.55rem",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
  lineHeight: 1,
};