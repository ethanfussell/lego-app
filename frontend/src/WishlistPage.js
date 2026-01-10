// frontend/src/WishlistPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import SetCard from "./SetCard";
import { apiFetch } from "./lib/api";

/* ---------------- helpers ---------------- */

function toPlainSetNum(sn) {
  return String(sn || "").split("-")[0];
}

function sortSets(arr, sortKey) {
  const items = Array.isArray(arr) ? [...arr] : [];
  const byName = (a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
      sensitivity: "base",
    });

  if (sortKey === "name_asc") items.sort(byName);
  else if (sortKey === "name_desc") items.sort((a, b) => byName(b, a));
  else if (sortKey === "year_desc")
    items.sort(
      (a, b) => Number(b?.year || 0) - Number(a?.year || 0) || byName(a, b)
    );
  else if (sortKey === "year_asc")
    items.sort(
      (a, b) => Number(a?.year || 0) - Number(b?.year || 0) || byName(a, b)
    );
  else if (sortKey === "pieces_desc")
    items.sort(
      (a, b) => Number(b?.pieces || 0) - Number(a?.pieces || 0) || byName(a, b)
    );
  else if (sortKey === "pieces_asc")
    items.sort(
      (a, b) => Number(a?.pieces || 0) - Number(b?.pieces || 0) || byName(a, b)
    );
  else if (sortKey === "rating_desc")
    items.sort(
      (a, b) =>
        Number(b?.average_rating || 0) - Number(a?.average_rating || 0) ||
        byName(a, b)
    );
  else if (sortKey === "rating_asc")
    items.sort(
      (a, b) =>
        Number(a?.average_rating || 0) - Number(a?.average_rating || 0) ||
        byName(a, b)
    );

  return items;
}

/* ---------------- sortable tile ---------------- */

function SortableSetTile({
  item,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
  disabled,
}) {
  const id = item?.set_num;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    cursor: disabled ? "default" : "grab",
    // IMPORTANT: no maxWidth / centered margin — fixes dead space
    width: "100%",
  };

  // Prevent clicking buttons inside the card while dragging
  const innerStyle = { pointerEvents: "none" };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={innerStyle}>
        <SetCard
          set={item}
          isOwned={ownedSetNums?.has?.(item.set_num)}
          isInWishlist={wishlistSetNums?.has?.(item.set_num)}
          onMarkOwned={(sn) => onMarkOwned?.(sn)}
          onAddWishlist={(sn) => onAddWishlist?.(sn)}
          variant="default"
        />
      </div>
    </div>
  );
}

/* ===================== page ===================== */

export default function WishlistPage({
  wishlistSets,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState(() => wishlistSets || []);
  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  // "custom" = backend-saved order
  const [sortKey, setSortKey] = useState("custom");

  const lastGoodRef = useRef(items);

  // keep local state in sync if parent reloads wishlist
  useEffect(() => {
    setItems(wishlistSets || []);
    lastGoodRef.current = wishlistSets || [];
  }, [wishlistSets]);

  const ids = useMemo(() => (items || []).map((x) => x.set_num), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeItem = useMemo(
    () => (activeId ? items.find((x) => x.set_num === activeId) : null),
    [activeId, items]
  );

  const displayedItems = useMemo(() => {
    // While reordering, always show the custom order
    if (reorderMode) return items;
    if (sortKey === "custom") return items;
    return sortSets(items, sortKey);
  }, [items, sortKey, reorderMode]);

  async function persistOrder(nextItems, prevItems) {
    const setNums = nextItems.map((x) => toPlainSetNum(x.set_num));

    setSaving(true);
    try {
      await apiFetch("/collections/wishlist/order", {
        method: "PUT",
        token,
        body: { set_nums: setNums },
      });
      lastGoodRef.current = nextItems;
    } catch (err) {
      console.error(err);
      setItems(prevItems);
      lastGoodRef.current = prevItems;
      window.alert(`Couldn’t save order: ${err?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(event) {
    setActiveId(event.active?.id ?? null);
    lastGoodRef.current = items;
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const prevItems = lastGoodRef.current || items;
    const oldIndex = items.findIndex((x) => x.set_num === active.id);
    const newIndex = items.findIndex((x) => x.set_num === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextItems = arrayMove(items, oldIndex, newIndex);
    setItems(nextItems);
    persistOrder(nextItems, prevItems);
  }

  const canReorder = ids.length > 1;

  // IMPORTANT: use auto-fill + smaller min width -> tighter layout (4-up sooner)
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 12,
    alignItems: "start",
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1280, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Wishlist</h1>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ color: "#444", fontSize: 14 }}>
            Sort{" "}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              disabled={reorderMode}
              style={{ padding: "0.25rem 0.5rem" }}
              title={reorderMode ? "Finish reordering to sort" : "Sort wishlist"}
            >
              <option value="custom">Custom order</option>
              <option value="name_asc">Name (A–Z)</option>
              <option value="name_desc">Name (Z–A)</option>
              <option value="year_desc">Year (new → old)</option>
              <option value="year_asc">Year (old → new)</option>
              <option value="pieces_desc">Pieces (high → low)</option>
              <option value="pieces_asc">Pieces (low → high)</option>
              <option value="rating_desc">Rating (high → low)</option>
              <option value="rating_asc">Rating (low → high)</option>
            </select>
          </label>

          <div style={{ color: "#666", fontSize: 14 }}>
            {saving ? "Saving order…" : reorderMode ? "Drag cards to reorder" : ""}
          </div>

          {canReorder && (
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                setReorderMode((v) => !v);
                setActiveId(null);
                setSortKey("custom");
              }}
              disabled={saving}
              style={{
                padding: "0.35rem 0.8rem",
                borderRadius: "999px",
                border: "1px solid #ddd",
                background: "white",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {reorderMode ? "Done" : "Reorder"}
            </button>
          )}
        </div>
      </div>

      {ids.length === 0 ? (
        <p style={{ color: "#666" }}>Your wishlist is empty.</p>
      ) : reorderMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div style={gridStyle}>
              {items.map((item) => (
                <SortableSetTile
                  key={item.set_num}
                  item={item}
                  ownedSetNums={ownedSetNums || new Set()}
                  wishlistSetNums={wishlistSetNums || new Set()}
                  onMarkOwned={onMarkOwned}
                  onAddWishlist={onAddWishlist}
                  disabled={saving}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem ? (
              <div style={{ width: 280, opacity: 0.95, pointerEvents: "none" }}>
                <SetCard set={activeItem} variant="default" />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div style={gridStyle}>
          {displayedItems.map((item) => (
            <div key={item.set_num} onClick={() => navigate(`/sets/${item.set_num}`)}>
              <SetCard
                set={item}
                isOwned={ownedSetNums?.has?.(item.set_num)}
                isInWishlist={wishlistSetNums?.has?.(item.set_num)}
                onMarkOwned={(sn) => onMarkOwned?.(sn)}
                onAddWishlist={(sn) => onAddWishlist?.(sn)}
                variant="default"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}