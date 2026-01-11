// frontend/src/ListDetailPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./auth";
import SetCard from "./SetCard";
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

/* ---------------- helpers ---------------- */

function toPlainSetNum(sn) {
  const s = String(sn || "").trim();
  if (!s) return "";
  return s.includes("-") ? s.split("-")[0] : s;
}

async function fetchSetsBulk(rawSetNums, token) {
  // rawSetNums can be ["30708-1", ...] or sometimes objects
  const nums = (Array.isArray(rawSetNums) ? rawSetNums : [])
    .map((x) => {
      if (typeof x === "string" || typeof x === "number") return String(x).trim();
      if (x && typeof x === "object") return String(x.set_num || x.setNum || "").trim();
      return "";
    })
    .filter(Boolean);

  if (nums.length === 0) return [];

  const params = new URLSearchParams();
  params.set("set_nums", nums.join(","));

  const data = await apiFetch(`/sets/bulk?${params.toString()}`, { token });

  // Preserve original order
  const arr = Array.isArray(data) ? data : [];
  const byNum = new Map(arr.map((s) => [String(s?.set_num || "").trim(), s]));
  return nums.map((n) => byNum.get(n)).filter(Boolean);
}

function sortSets(arr, sortKey) {
  const items = Array.isArray(arr) ? [...arr] : [];
  const byName = (a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" });

  if (sortKey === "name_asc") items.sort(byName);
  else if (sortKey === "name_desc") items.sort((a, b) => byName(b, a));
  else if (sortKey === "year_desc")
    items.sort((a, b) => Number(b?.year || 0) - Number(a?.year || 0) || byName(a, b));
  else if (sortKey === "year_asc")
    items.sort((a, b) => Number(a?.year || 0) - Number(b?.year || 0) || byName(a, b));
  else if (sortKey === "pieces_desc")
    items.sort((a, b) => Number(b?.pieces || 0) - Number(a?.pieces || 0) || byName(a, b));
  else if (sortKey === "pieces_asc")
    items.sort((a, b) => Number(a?.pieces || 0) - Number(b?.pieces || 0) || byName(a, b));
  else if (sortKey === "rating_desc")
    items.sort(
      (a, b) => Number(b?.average_rating || 0) - Number(a?.average_rating || 0) || byName(a, b)
    );
  else if (sortKey === "rating_asc")
    items.sort(
      (a, b) => Number(a?.average_rating || 0) - Number(b?.average_rating || 0) || byName(a, b)
    );

  return items;
}

function SortableSetTile({
  item,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
  disabled,
}) {
  const id = item?.set_num; // FULL set_num is the drag id in the UI

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

  // In reorder mode, prevent button clicks inside cards
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

/* ---------------- page ---------------- */

export default function ListDetailPage({
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const { listId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [listName, setListName] = useState("List");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  // Sort: "custom" = backend order for THIS list
  const [sortKey, setSortKey] = useState("custom");

  const lastGoodRef = useRef(items);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await apiFetch(`/lists/${encodeURIComponent(listId)}`, { token });

        const name = data?.name || data?.title || "List";
        const rawItems = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.sets)
          ? data.sets
          : [];

        const fullSets = await fetchSetsBulk(rawItems, token);
        const cleaned = fullSets.filter((x) => x && x.set_num);
        const expectedCount = Array.isArray(rawItems) ? rawItems.length : 0;
        const loadedCount = cleaned.length;

        const canReorderSafely = expectedCount > 1 && loadedCount === expectedCount;

        if (cancelled) return;
        setListName(name);
        setItems(cleaned);
        lastGoodRef.current = cleaned;
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setError(e?.message || "Failed to load list");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (listId) load();

    return () => {
      cancelled = true;
    };
  }, [listId, token]);

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
    if (reorderMode) return items;
    if (sortKey === "custom") return items;
    return sortSets(items, sortKey);
  }, [items, sortKey, reorderMode]);

  async function persistOrder(nextItems, prevItems) {
    const setNums = (Array.isArray(nextItems) ? nextItems : [])
      .map((x) => String(x?.set_num || "").trim())
      .filter(Boolean);
  
    setSaving(true);
    try {
      await apiFetch(`/lists/${encodeURIComponent(listId)}/items/order`, {
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

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    alignItems: "start",
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: "#b91c1c" }}>{error}</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ marginTop: 0 }}>{listName}</h1>
          <span style={{ color: "#6b7280", fontSize: 14 }}>{items.length} sets</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/collection")}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Back
          </button>

          <label style={{ color: "#444", fontSize: 14 }}>
            Sort{" "}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              disabled={reorderMode}
              style={{ padding: "0.25rem 0.5rem" }}
              title={reorderMode ? "Finish reordering to sort" : "Sort this list"}
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

      {items.length === 0 ? (
        <p style={{ color: "#666" }}>This list is empty.</p>
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
              <div style={{ width: 320, opacity: 0.95, pointerEvents: "none" }}>
                <SetCard set={activeItem} variant="default" />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div style={gridStyle}>
          {displayedItems.map((item) => (
            <div
              key={item.set_num}
              onClick={() => navigate(`/sets/${encodeURIComponent(item.set_num)}`)}
              style={{ cursor: "pointer" }}
            >
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