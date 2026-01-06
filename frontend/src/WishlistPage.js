import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import SetCard from "./SetCard";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

function getToken() {
  // adjust if you store it under a different key
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("authToken") ||
    ""
  );
}

async function saveWishlistOrder(setNums) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/collections/wishlist/order`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ set_nums: setNums }),
  });

  if (!res.ok) {
    let detail = "Failed to save order";
    try {
      const j = await res.json();
      detail = j?.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  return res.json();
}

function DragHandle({ listeners, attributes, disabled }) {
  return (
    <button
      type="button"
      aria-label="Reorder"
      disabled={disabled}
      {...attributes}
      {...listeners}
      style={{
        cursor: disabled ? "not-allowed" : "grab",
        border: "1px solid #ddd",
        background: "white",
        borderRadius: 10,
        padding: "6px 10px",
        fontSize: 16,
        lineHeight: 1,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      ☰
    </button>
  );
}

function SortableWishlistRow({
  item,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
  onOpenSet,
  disabled,
}) {
  const id = item?.set_num;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 12,
    background: "white",
    boxShadow: isDragging ? "0 10px 30px rgba(0,0,0,0.12)" : "0 2px 10px rgba(0,0,0,0.04)",
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ paddingTop: 4 }}>
        <DragHandle listeners={listeners} attributes={attributes} disabled={disabled} />
      </div>

      <div style={{ flex: 1 }}>
        <div onClick={() => onOpenSet?.(item?.set_num)} style={{ cursor: "pointer" }}>
          <SetCard
            set={item}
            isOwned={ownedSetNums?.includes?.(item?.set_num)}
            isInWishlist={wishlistSetNums?.includes?.(item?.set_num)}
            onMarkOwned={(sn) => onMarkOwned?.(sn)}
            onAddWishlist={(sn) => onAddWishlist?.(sn)}
            variant="default"
          />
        </div>
      </div>
    </div>
  );
}

export default function WishlistPage({
  wishlistSets,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const navigate = useNavigate();

  const [items, setItems] = useState(() => wishlistSets || []);
  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);
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

  function onOpenSet(setNum) {
    if (!setNum) return;
    navigate(`/sets/${setNum}`);
  }

  async function persistOrder(nextItems, prevItems) {
    const setNums = nextItems.map((x) => x.set_num);

    setSaving(true);
    try {
      await saveWishlistOrder(setNums);
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

    // Save order to backend (full list, in order)
    persistOrder(nextItems, prevItems);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ marginTop: 0 }}>Wishlist</h1>
        <div style={{ color: "#666", fontSize: 14 }}>
          {saving ? "Saving order…" : ids.length ? "Drag the ☰ handle to reorder" : ""}
        </div>
      </div>

      {ids.length === 0 ? (
        <p style={{ color: "#666" }}>Your wishlist is empty.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div style={{ display: "grid", gap: 14 }}>
              {items.map((item) => (
                <SortableWishlistRow
                  key={item.set_num}
                  item={item}
                  ownedSetNums={ownedSetNums || []}
                  wishlistSetNums={wishlistSetNums || []}
                  onMarkOwned={onMarkOwned}
                  onAddWishlist={onAddWishlist}
                  onOpenSet={onOpenSet}
                  disabled={saving}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem ? (
              <div style={{ opacity: 0.95 }}>
                <div
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 12,
                    background: "white",
                    boxShadow: "0 14px 40px rgba(0,0,0,0.18)",
                    width: 340,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{activeItem.name}</div>
                  <div style={{ color: "#666", fontSize: 13 }}>{activeItem.set_num}</div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}