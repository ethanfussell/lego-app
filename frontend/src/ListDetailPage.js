// frontend/src/ListDetailPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import SetCard from "./SetCard";
import { apiFetch } from "./lib/api";
import { toggleSavedListId, isListSaved } from "./lib/savedLists";

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

function isHttpStatus(err, code) {
  return String(err?.message || "").startsWith(String(code));
}

// rawSetNums can be ["30708-1", ...] or sometimes objects with set_num
async function fetchSetsBulk(rawSetNums, token) {
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
    String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
      sensitivity: "base",
    });

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
      (a, b) =>
        Number(b?.average_rating || 0) - Number(a?.average_rating || 0) || byName(a, b)
    );
  else if (sortKey === "rating_asc")
    items.sort(
      (a, b) =>
        Number(a?.average_rating || 0) - Number(b?.average_rating || 0) || byName(a, b)
    );

  return items;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- DnD tile ---------------- */

function SortableSetTile({
  item,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
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

/* ---------------- UI: Header ---------------- */

function ListHeader({
  listName,
  ownerLabel,
  isPublic,
  itemCount,
  token,

  navigate,
  onShare,
  copied,

  sortKey,
  setSortKey,
  reorderMode,
  saving,

  canReorder,
  onToggleReorder,

  // ✅ new
  saved,
  onToggleSaved,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        flexWrap: "wrap",
        marginTop: 14,
      }}
    >
      {/* LEFT */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Title row + Save button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 6,
          }}
        >
          <h1 style={{ margin: 0 }}>{listName || "Untitled list"}</h1>

          <button
            type="button"
            onClick={onToggleSaved}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
            title={saved ? "Remove from saved lists" : "Save this list"}
          >
            {saved ? "★ Saved" : "☆ Save list"}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            color: "#6b7280",
            fontSize: 13,
          }}
        >
          {ownerLabel ? (
            <span>
              by <strong style={{ color: "#111827" }}>{ownerLabel}</strong>
            </span>
          ) : null}

          <span
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              color: "#4b5563",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
            title={isPublic ? "Public list" : "Private list"}
          >
            {isPublic ? "Public" : "Private"}
          </span>

          <span style={{ whiteSpace: "nowrap" }}>{itemCount} sets</span>
        </div>
      </div>

      {/* RIGHT */}
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

        {isPublic ? (
          <button
            type="button"
            onClick={onShare}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {copied ? "Link Copied!" : "Share"}
          </button>
        ) : null}

        {!token ? (
          <button
            type="button"
            onClick={() => {
              const returnTo = window.location.pathname + window.location.search;
              navigate("/login", { state: { returnTo } });
            }}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
            title="Log in to save sets to your collection"
          >
            Log in to save
          </button>
        ) : null}

        {token ? (
          <>
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

            {canReorder ? (
              <button
                type="button"
                onClick={onToggleReorder}
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
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- UI: Grid ---------------- */

function ListGrid({
  items,
  displayedItems,
  gridStyle,

  reorderMode,
  reorderEligible,

  sensors,
  ids,
  activeItem,
  saving,

  onDragStart,
  onDragCancel,
  onDragEnd,

  safeOwnedSetNums,
  safeWishlistSetNums,
  safeOnMarkOwned,
  safeOnAddWishlist,

  navigate,
}) {
  return (
    <div style={{ marginTop: 14 }}>
      {!reorderEligible && items.length > 1 ? (
        <div style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>
          Reorder is temporarily disabled (list items didn’t fully load).
        </div>
      ) : null}

      {items.length === 0 ? (
        <p style={{ color: "#666" }}>This list is empty.</p>
      ) : reorderMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragCancel={onDragCancel}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div style={gridStyle}>
              {items.map((item) => (
                <SortableSetTile
                  key={item.set_num}
                  item={item}
                  ownedSetNums={safeOwnedSetNums}
                  wishlistSetNums={safeWishlistSetNums}
                  onMarkOwned={safeOnMarkOwned}
                  onAddWishlist={safeOnAddWishlist}
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
                isOwned={safeOwnedSetNums?.has?.(item.set_num)}
                isInWishlist={safeWishlistSetNums?.has?.(item.set_num)}
                onMarkOwned={safeOnMarkOwned}
                onAddWishlist={safeOnAddWishlist}
                variant="default"
              />
            </div>
          ))}
        </div>
      )}
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
  const [saved, setSaved] = useState(() => isListSaved(listId));

  useEffect(() => {
    setSaved(isListSaved(listId));
  }, [listId]);

  function handleToggleSaved() {
    toggleSavedListId(listId);
    setSaved(isListSaved(listId));
  
    // optional: tell other tabs/pages
    window.dispatchEvent(new Event("storage"));
  }

  const { token } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const returnTo = routerLocation.pathname + routerLocation.search;

  // Gate list actions behind auth (logged-out public view should be read-only)
  const safeOwnedSetNums = token ? ownedSetNums || new Set() : new Set();
  const safeWishlistSetNums = token ? wishlistSetNums || new Set() : new Set();
  const safeOnMarkOwned = token ? onMarkOwned : undefined;
  const safeOnAddWishlist = token ? onAddWishlist : undefined;

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState(null);
  const [listName, setListName] = useState("List");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderEligible, setReorderEligible] = useState(false);

  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef(null);

  const [sortKey, setSortKey] = useState("custom");
  const lastGoodRef = useRef(items);


  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setList(null);

      try {
        const data = await apiFetch(`/lists/${encodeURIComponent(listId)}`, { token });
        if (cancelled) return;

        setList(data || null);

        const name = data?.title || data?.name || "List";
        const rawItems = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.sets)
          ? data.sets
          : [];

        // normalize into ["21357-1", ...] no matter what shape backend sends
        const rawSetNums = rawItems
          .map((x) => {
            if (typeof x === "string" || typeof x === "number") return String(x).trim();
            if (x && typeof x === "object") return String(x.set_num || x.setNum || "").trim();
            return "";
          })
          .filter(Boolean);

        const fullSets = await fetchSetsBulk(rawSetNums, token);
        const cleaned = fullSets.filter((x) => x && x.set_num);

        // eligible only if we successfully loaded ALL sets (so DnD ids match exactly)
        const expectedCount = rawSetNums.length;
        const loadedCount = cleaned.length;
        const canReorderSafely = expectedCount > 1 && loadedCount === expectedCount;

        if (cancelled) return;

        setListName(name);
        setItems(cleaned);
        setReorderEligible(canReorderSafely);

        if (!canReorderSafely) setReorderMode(false);

        lastGoodRef.current = cleaned;
      } catch (e) {
        if (cancelled) return;

        setList(null);

        // backend intentionally returns 404 for private OR missing
        if (isHttpStatus(e, 404)) {
          setError(
            !token
              ? "This list doesn’t exist, or it’s private."
              : "List not found (or you don’t have access)."
          );
        } else {
          setError(e?.message || "Failed to load list");
        }
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
    if (reorderMode) return items; // keep custom order while dragging
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

      const msg = String(err?.message || "");
      if (msg.startsWith("403")) window.alert("You don’t have permission to reorder this list.");
      else window.alert(`Couldn’t save order: ${err?.message || "unknown error"}`);
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

  const canReorder = !!token && reorderEligible && ids.length > 1;

  const CARD_W = 220;
  const gridStyle = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: `repeat(auto-fill, ${CARD_W}px)`,
      gap: 14,
      alignItems: "start",
      justifyContent: "start",
    }),
    []
  );

  async function handleShare() {
    const url = window.location.href;

    if (!list?.is_public) {
      window.alert("Make this list public to share it.");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: listName ? `${listName} — LEGO List` : "LEGO List",
          text: "Check out this LEGO list",
          url,
        });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }

    const ok = await copyToClipboard(url);
    if (!ok) {
      window.prompt("Copy this link:", url);
      return;
    }

    setCopied(true);
    if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 1200);
  }

  if (loading) return <div>Loading…</div>;

  if (error) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
        <div
          style={{
            border: "1px solid #fee2e2",
            background: "#fff1f2",
            padding: "1rem",
            borderRadius: 12,
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          {error}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/discover")}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Back to Discover
          </button>

          {!token ? (
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Log in
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const ownerLabel = list?.owner || list?.owner_username || list?.username || "";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1rem" }}>
      <ListHeader
        listName={listName}
        ownerLabel={ownerLabel}
        isPublic={!!list?.is_public}
        itemCount={items.length}
        token={token}
        navigate={navigate}
        onShare={handleShare}
        copied={copied}
        sortKey={sortKey}
        setSortKey={setSortKey}
        reorderMode={reorderMode}
        saving={saving}
        canReorder={canReorder}
        onToggleReorder={() => {
          if (saving) return;
          setReorderMode((v) => !v);
          setActiveId(null);
          setSortKey("custom");
        }}

        saved={saved}
        onToggleSaved={handleToggleSaved}
      />

      <ListGrid
        items={items}
        displayedItems={displayedItems}
        gridStyle={gridStyle}
        reorderMode={reorderMode}
        reorderEligible={reorderEligible}
        sensors={sensors}
        ids={ids}
        activeItem={activeItem}
        saving={saving}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        safeOwnedSetNums={safeOwnedSetNums}
        safeWishlistSetNums={safeWishlistSetNums}
        safeOnMarkOwned={safeOnMarkOwned}
        safeOnAddWishlist={safeOnAddWishlist}
        navigate={navigate}
      />
    </div>
  );
}