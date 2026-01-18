// frontend/src/MyListsSection.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth";
import { apiFetch } from "./lib/api";

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

function sortByPosition(lists) {
  const arr = Array.isArray(lists) ? [...lists] : [];
  arr.sort((a, b) => Number(a?.position ?? 0) - Number(b?.position ?? 0));
  return arr;
}

function ListCardInner({ list }) {
  const title = list?.title || list?.name || "Untitled list";
  const count = Number(list?.items_count ?? 0);
  const isPublic = !!list?.is_public;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "white",
        padding: 12,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
        <div style={{ fontWeight: 750, color: "#111827", lineHeight: "1.15em" }}>{title}</div>

        <span
          style={{
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            color: "#4b5563",
            whiteSpace: "nowrap",
          }}
        >
          {count} {count === 1 ? "set" : "sets"}
        </span>
      </div>

      {list?.description ? (
        <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>{list.description}</div>
      ) : null}

      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: "#6b7280" }}>{isPublic ? "Public" : "Private"}</span>
        {list?.is_system ? <span style={{ fontSize: 12.5, color: "#6b7280" }}>· System</span> : null}
      </div>
    </div>
  );
}

function ListCardLink({ list }) {
  const to = `/lists/${encodeURIComponent(list.id)}`;

  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <ListCardInner list={list} />
    </Link>
  );
}

function SortableListCard({ list, disabled }) {
  const id = String(list?.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    cursor: disabled ? "default" : "grab",
  };

  // In reorder mode: NOT a link (so dragging is clean)
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ListCardInner list={list} />
    </div>
  );
}

export default function MyListsSection({ lists = [], onListsChange }) {
  const { token } = useAuth();

  const [items, setItems] = useState(() => sortByPosition(lists));
  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  const lastGoodRef = useRef(items);

  useEffect(() => {
    const sorted = sortByPosition(lists);
    setItems(sorted);
    lastGoodRef.current = sorted;
  }, [lists]);

  const ids = useMemo(() => items.map((x) => String(x.id)), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    return items.find((x) => String(x.id) === String(activeId)) || null;
  }, [activeId, items]);

  const canReorder = ids.length > 1;

  async function persistOrder(nextItems, prevItems) {
    const orderedIds = nextItems
      .map((x) => x?.id)
      .filter((x) => x !== null && x !== undefined)
      .map((x) => Number(x));

    setSaving(true);
    try {
      await apiFetch("/lists/me/order", {
        method: "PUT",
        token,
        body: { ordered_ids: orderedIds },
      });

      const withPos = nextItems.map((l, i) => ({ ...l, position: i }));
      setItems(withPos);
      lastGoodRef.current = withPos;
      onListsChange?.(withPos);
    } catch (err) {
      console.error(err);
      setItems(prevItems);
      lastGoodRef.current = prevItems;
      onListsChange?.(prevItems);
      window.alert(`Couldn’t save list order: ${err?.message || "unknown error"}`);
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
    const oldIndex = items.findIndex((x) => String(x.id) === String(active.id));
    const newIndex = items.findIndex((x) => String(x.id) === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const nextItems = arrayMove(items, oldIndex, newIndex);
    setItems(nextItems);
    persistOrder(nextItems, prevItems);
  }

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 240px))",
    gap: 14,
    alignItems: "start",
    justifyContent: "start",
  };

  return (
    <section style={{ marginTop: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>My Lists</h2>
          <span style={{ color: "#6b7280", fontSize: 14 }}>{items.length} lists</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ color: "#666", fontSize: 14 }}>
            {saving ? "Saving order…" : reorderMode ? "Drag lists to reorder" : ""}
          </div>

          {canReorder && (
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                setReorderMode((v) => !v);
                setActiveId(null);
              }}
              disabled={saving}
              style={{
                padding: "0.35rem 0.8rem",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "white",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 800,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {reorderMode ? "Done" : "Reorder"}
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p style={{ color: "#666" }}>You don’t have any custom lists yet.</p>
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
              {items.map((list) => (
                <SortableListCard key={list.id} list={list} disabled={saving} />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem ? (
              <div style={{ opacity: 0.95, pointerEvents: "none", width: 320 }}>
                <ListCardInner list={activeItem} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div style={gridStyle}>
          {items.map((list) => (
            <ListCardLink key={list.id} list={list} />
          ))}
        </div>
      )}
    </section>
  );
}