// frontend/src/CollectionsPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SetCard from "./SetCard";

const API_BASE = "http://localhost:8000";
const PREVIEW_COUNT = 10;

// ---------------- utils ----------------
function getStoredToken() {
  return localStorage.getItem("lego_token") || "";
}

function getUsernameFromToken(token) {
  if (!token) return null;
  const prefix = "fake-token-for-";
  return token.startsWith(prefix) ? token.slice(prefix.length) : token;
}

async function fetchSetDetail(setNum, token) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const resp = await fetch(`${API_BASE}/sets/${encodeURIComponent(setNum)}`, {
      headers,
    });
    if (!resp.ok) return null;
    return await resp.json(); // includes user_rating when token provided
  } catch {
    return null;
  }
}

function useIsMobile(breakpointPx = 720) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const handler = (e) => setIsMobile(e.matches);

    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);

    setIsMobile(mq.matches);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, [breakpointPx]);

  return isMobile;
}

// ---------------- UI: reusable horizontal row ----------------
function CollectionRow({
  title,
  totalCount,
  sets,
  viewAllLabel,
  onViewAll,
  emptyText,
  rightActions,
}) {
  const preview = Array.isArray(sets) ? sets.slice(0, PREVIEW_COUNT) : [];

  return (
    <section style={{ marginTop: "1.75rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
          <p style={{ margin: "0.2rem 0 0 0", color: "#777", fontSize: "0.9rem" }}>
            {totalCount === 1 ? "1 set" : `${totalCount} sets`}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {rightActions}
          <button
            type="button"
            onClick={onViewAll}
            disabled={!onViewAll}
            style={{
              padding: "0.35rem 0.9rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              fontSize: "0.85rem",
              cursor: onViewAll ? "pointer" : "not-allowed",
              opacity: onViewAll ? 1 : 0.6,
            }}
          >
            {viewAllLabel}
          </button>
        </div>
      </div>

      {preview.length === 0 ? (
        <p style={{ margin: 0, color: "#777" }}>{emptyText}</p>
      ) : (
        <div style={{ overflowX: "auto", paddingBottom: "0.5rem" }}>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              gap: "0.75rem",
            }}
          >
            {preview.map((set) => (
              <li
                key={set.set_num}
                style={{ minWidth: "220px", maxWidth: "220px", flex: "0 0 auto" }}
              >
                <SetCard set={set} variant="collection" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------- UI: mobile reorder sheet ----------------
function ReorderSheet({
  open,
  onClose,
  draftLists,
  setDraftLists,
  onSave,
  saving,
  error,
}) {
  if (!open) return null;

  function moveDraft(listId, dir) {
    setDraftLists((prev) => {
      const idx = prev.findIndex((l) => l.id === listId);
      const newIdx = idx + dir;
      if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[newIdx];
      copy[newIdx] = tmp;
      return copy;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 60,
        display: "grid",
        placeItems: "end center",
        padding: "1rem",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: "16px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          padding: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "0.75rem",
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Reorder lists</div>
            <div style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.15rem" }}>
              Move lists up/down, then hit Save.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "0.35rem 0.7rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>

        {error && <div style={{ color: "red", marginBottom: "0.75rem" }}>{error}</div>}

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
          {draftLists.map((l, idx) => (
            <li
              key={l.id}
              style={{
                border: "1px solid #eee",
                borderRadius: "12px",
                padding: "0.75rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {l.title}
                </div>
                <div style={{ color: "#777", fontSize: "0.85rem", marginTop: "0.15rem" }}>
                  {l.items_count ?? (Array.isArray(l.items) ? l.items.length : 0)} sets ·{" "}
                  {l.is_public ? "Public" : "Private"}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.35rem" }}>
                <button
                  type="button"
                  onClick={() => moveDraft(l.id, -1)}
                  disabled={saving || idx === 0}
                  style={{
                    padding: "0.3rem 0.6rem",
                    borderRadius: "999px",
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: saving || idx === 0 ? "not-allowed" : "pointer",
                    opacity: saving || idx === 0 ? 0.5 : 1,
                  }}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDraft(l.id, +1)}
                  disabled={saving || idx === draftLists.length - 1}
                  style={{
                    padding: "0.3rem 0.6rem",
                    borderRadius: "999px",
                    border: "1px solid #ddd",
                    background: "white",
                    cursor:
                      saving || idx === draftLists.length - 1 ? "not-allowed" : "pointer",
                    opacity: saving || idx === draftLists.length - 1 ? 0.5 : 1,
                  }}
                  title="Move down"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.9rem" }}>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "999px",
              border: "none",
              background: saving ? "#888" : "#111827",
              color: "white",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {saving ? "Saving…" : "Save order"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- UI: list menu + edit modal ----------------
function ListMenuButton({ open, onToggle }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        width: 34,
        height: 34,
        borderRadius: "999px",
        border: "1px solid #ddd",
        background: "white",
        cursor: "pointer",
        fontSize: "18px",
        lineHeight: "1",
        display: "grid",
        placeItems: "center",
      }}
      title="More"
      aria-haspopup="menu"
      aria-expanded={open ? "true" : "false"}
    >
      ⋯
    </button>
  );
}

function ListMenuDropdown({ onEdit, onDelete }) {
  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 6px)",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        minWidth: 160,
        padding: 6,
        zIndex: 50,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onEdit}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 10px",
          borderRadius: 10,
          border: "none",
          background: "white",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        ✏️ Edit
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={onDelete}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 10px",
          borderRadius: 10,
          border: "none",
          background: "white",
          cursor: "pointer",
          fontWeight: 700,
          color: "#b42318",
        }}
      >
        🗑️ Delete
      </button>
    </div>
  );
}

function EditListModal({
  open,
  title,
  setTitle,
  desc,
  setDesc,
  isPublic,
  setIsPublic,
  saving,
  error,
  onClose,
  onSave,
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "white",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          padding: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Edit list</div>
            <div style={{ color: "#666", fontSize: "0.9rem", marginTop: 2 }}>
              Update title / description / public setting.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "0.35rem 0.7rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>

        <form onSubmit={onSave} style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: "0.9rem", color: "#333" }}>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                padding: "0.55rem 0.65rem",
                borderRadius: 10,
                border: "1px solid #d1d5db",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: "0.9rem", color: "#333" }}>
              Description (optional)
            </span>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={{
                padding: "0.55rem 0.65rem",
                borderRadius: 10,
                border: "1px solid #d1d5db",
              }}
            />
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span style={{ fontSize: "0.9rem", color: "#333" }}>
              Public (shows up in Explore)
            </span>
          </label>

          {error && <div style={{ color: "red" }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: "999px",
                border: "none",
                background: saving ? "#888" : "#111827",
                color: "white",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------- main page ----------------
export default function CollectionsPage({ ownedSets = [], wishlistSets = [], token }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile(720);

  const effectiveToken = token || getStoredToken();
  const isLoggedIn = !!effectiveToken;

  // (not required for this page, but kept in case you want it later)
  const currentUsername = useMemo(
    () => getUsernameFromToken(effectiveToken),
    [effectiveToken]
  );

  // menu + edit/delete state
  const [menuOpenFor, setMenuOpenFor] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const [deleteError, setDeleteError] = useState(null);

  // close menu on outside click
  useEffect(() => {
    function onDocMouseDown() {
      setMenuOpenFor(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  async function apiUpdateList(listId, payload) {
    const resp = await fetch(`${API_BASE}/lists/${encodeURIComponent(listId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Update failed (${resp.status}): ${text}`);
    }
    return await resp.json();
  }

  async function apiDeleteList(listId) {
    const resp = await fetch(`${API_BASE}/lists/${encodeURIComponent(listId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${effectiveToken}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Delete failed (${resp.status}): ${text}`);
    }
    return await resp.json();
  }

  // normalize incoming owned/wishlist props:
  const ownedNums = useMemo(
    () =>
      (ownedSets || [])
        .map((x) => (typeof x === "string" ? x : x?.set_num))
        .filter(Boolean),
    [ownedSets]
  );

  const wishlistNums = useMemo(
    () =>
      (wishlistSets || [])
        .map((x) => (typeof x === "string" ? x : x?.set_num))
        .filter(Boolean),
    [wishlistSets]
  );

  // previews
  const [ownedDetails, setOwnedDetails] = useState([]);
  const [wishlistDetails, setWishlistDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // lists
  const [myLists, setMyLists] = useState([]);
  const myListsRef = useRef([]);
  useEffect(() => {
    myListsRef.current = myLists;
  }, [myLists]);

  const [myListsLoading, setMyListsLoading] = useState(false);
  const [myListsLoadError, setMyListsLoadError] = useState(null);

  const [reorderSaving, setReorderSaving] = useState(false);
  const [reorderError, setReorderError] = useState(null);

  const [listPreviewSets, setListPreviewSets] = useState({}); // { [listId]: [setObj,...] }

  // create list UI
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState(null);

  // mobile reorder sheet state
  const [showReorderSheet, setShowReorderSheet] = useState(false);
  const [draftLists, setDraftLists] = useState([]);

  // ------------ data helpers ------------
  async function fetchMyLists() {
    if (!isLoggedIn) {
      setMyLists([]);
      setListPreviewSets({});
      return [];
    }

    const resp = await fetch(`${API_BASE}/lists/me`, {
      headers: { Authorization: `Bearer ${effectiveToken}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to load my lists (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  }

  async function persistListOrder(orderedLists) {
    const orderedIds = orderedLists.map((l) => l.id);

    const resp = await fetch(`${API_BASE}/lists/me/order`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveToken}`,
      },
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Reorder failed (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    return Array.isArray(data) ? data : orderedLists;
  }

  function openEditForList(list) {
    setMenuOpenFor(null);
    setEditTarget(list);
    setEditTitle(list.title || "");
    setEditDesc(list.description || "");
    setEditIsPublic(!!list.is_public);
    setEditError(null);
    setEditOpen(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editTarget) return;

    try {
      setEditSaving(true);
      setEditError(null);

      const payload = {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        is_public: !!editIsPublic,
      };

      if (!payload.title) {
        setEditError("Title is required.");
        return;
      }

      const updated = await apiUpdateList(editTarget.id, payload);

      setMyLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setEditOpen(false);
    } catch (err) {
      setEditError(err?.message || String(err));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteList(list) {
    setMenuOpenFor(null);
    setDeleteError(null);

    const ok = window.confirm(`Delete "${list.title}"? This cannot be undone.`);
    if (!ok) return;

    try {
      await apiDeleteList(list.id);

      const remaining = myListsRef.current.filter((x) => x.id !== list.id);
      setMyLists(remaining);

      setListPreviewSets((prev) => {
        const copy = { ...prev };
        delete copy[list.id];
        return copy;
      });

      // keep backend order consistent
      if (remaining.length > 0) {
        try {
          const saved = await persistListOrder(remaining);
          setMyLists(saved);
        } catch {
          // ignore reorder failure here; UI already updated
        }
      }
    } catch (err) {
      setDeleteError(err?.message || String(err));
    }
  }

  // ------------ Owned/Wishlist previews ------------
  useEffect(() => {
    let cancelled = false;

    async function loadOwnedWishlist() {
      try {
        setLoading(true);
        setError(null);

        const [ownedFull, wishlistFull] = await Promise.all([
          Promise.all(
            ownedNums.slice(0, PREVIEW_COUNT).map((n) => fetchSetDetail(n, effectiveToken))
          ),
          Promise.all(
            wishlistNums
              .slice(0, PREVIEW_COUNT)
              .map((n) => fetchSetDetail(n, effectiveToken))
          ),
        ]);

        if (!cancelled) {
          setOwnedDetails(ownedFull.filter(Boolean));
          setWishlistDetails(wishlistFull.filter(Boolean));
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOwnedWishlist();
    return () => {
      cancelled = true;
    };
  }, [ownedNums, wishlistNums, effectiveToken]);

  // ------------ Load my lists ------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isLoggedIn) {
        setMyLists([]);
        setListPreviewSets({});
        return;
      }

      try {
        setMyListsLoading(true);
        setMyListsLoadError(null);
        const data = await fetchMyLists();
        if (!cancelled) setMyLists(data);
      } catch (e) {
        if (!cancelled) setMyListsLoadError(e?.message || String(e));
      } finally {
        if (!cancelled) setMyListsLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveToken, isLoggedIn]);

  // ------------ Load preview set cards for each list ------------
  useEffect(() => {
    let cancelled = false;

    async function loadListPreviews() {
      if (!myLists || myLists.length === 0) {
        setListPreviewSets({});
        return;
      }

      const entries = await Promise.all(
        myLists.map(async (l) => {
          const items = Array.isArray(l.items) ? l.items : [];
          const first = items.slice(0, PREVIEW_COUNT);
          const full = await Promise.all(first.map((n) => fetchSetDetail(n, effectiveToken)));
          return [l.id, full.filter(Boolean)];
        })
      );

      if (!cancelled) {
        const map = {};
        for (const [id, sets] of entries) map[id] = sets;
        setListPreviewSets(map);
      }
    }

    loadListPreviews();
    return () => {
      cancelled = true;
    };
  }, [myLists, effectiveToken]);

  // ------------ Create list ------------
  async function handleCreateList(e) {
    e.preventDefault();
    if (!isLoggedIn) return;

    const t = newTitle.trim();
    if (!t) {
      setCreateErr("Title is required.");
      return;
    }

    try {
      setCreating(true);
      setCreateErr(null);
      setMyListsLoadError(null);
      setReorderError(null);

      const resp = await fetch(`${API_BASE}/lists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          title: t,
          description: newDesc.trim() || null,
          is_public: !!newIsPublic,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Create list failed (${resp.status}): ${text}`);
      }

      const created = await resp.json();

      // Put it at top in UI, then persist that order so backend matches.
      const optimistic = [created, ...myListsRef.current];
      setMyLists(optimistic);

      setReorderSaving(true);
      try {
        const saved = await persistListOrder(optimistic);
        setMyLists(saved);
      } finally {
        setReorderSaving(false);
      }

      setNewTitle("");
      setNewDesc("");
      setNewIsPublic(true);
      setShowCreate(false);
    } catch (err) {
      setCreateErr(err?.message || String(err));
    } finally {
      setCreating(false);
    }
  }

  // ------------ Desktop reorder ------------
  async function moveListDesktop(listId, dir) {
    if (!isLoggedIn || reorderSaving) return;

    setReorderError(null);

    const prev = myListsRef.current;
    const idx = prev.findIndex((l) => l.id === listId);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return;

    const updated = [...prev];
    const tmp = updated[idx];
    updated[idx] = updated[newIdx];
    updated[newIdx] = tmp;

    setMyLists(updated);

    try {
      setReorderSaving(true);
      const saved = await persistListOrder(updated);
      setMyLists(saved);
    } catch (e) {
      setMyLists(prev);
      setReorderError(e?.message || String(e));
    } finally {
      setReorderSaving(false);
    }
  }

  // ------------ Mobile reorder sheet ------------
  function openReorder() {
    setReorderError(null);
    setDraftLists(myListsRef.current);
    setShowReorderSheet(true);
  }

  async function saveReorderSheet() {
    if (!isLoggedIn || reorderSaving) return;

    const prev = myListsRef.current;
    const draft = draftLists;

    setMyLists(draft); // optimistic

    try {
      setReorderSaving(true);
      const saved = await persistListOrder(draft);
      setMyLists(saved);
      setShowReorderSheet(false);
    } catch (e) {
      setMyLists(prev);
      setReorderError(e?.message || String(e));
    } finally {
      setReorderSaving(false);
    }
  }

  const hasAny =
    ownedDetails.length > 0 ||
    wishlistDetails.length > 0 ||
    (myLists && myLists.length > 0);

  const showReorderButton = isLoggedIn && myLists.length > 1;

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.7rem" }}>My Collection</h1>
          <p style={{ marginTop: "0.4rem", color: "#666" }}>
            View your Owned, Wishlist, and custom Lists in one place.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {showReorderButton && isMobile && (
            <button
              type="button"
              onClick={openReorder}
              disabled={reorderSaving}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid #ddd",
                background: "white",
                cursor: reorderSaving ? "not-allowed" : "pointer",
                opacity: reorderSaving ? 0.6 : 1,
                fontWeight: 600,
              }}
            >
              ⇅ Reorder
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCreate((p) => !p)}
            disabled={!isLoggedIn}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: isLoggedIn ? "pointer" : "not-allowed",
              opacity: isLoggedIn ? 1 : 0.6,
              fontWeight: 600,
            }}
            title={isLoggedIn ? "Create a new list" : "Log in to create lists"}
          >
            ➕ Create list
          </button>
        </div>
      </div>

      {/* Create list form */}
      {showCreate && isLoggedIn && (
        <form
          onSubmit={handleCreateList}
          style={{
            marginTop: "0.9rem",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "0.9rem",
            background: "#fafafa",
          }}
        >
          <div style={{ display: "grid", gap: "0.6rem" }}>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.9rem", color: "#333" }}>Title</span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. My Favorites"
                style={{
                  padding: "0.5rem 0.6rem",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.9rem", color: "#333" }}>
                Description (optional)
              </span>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. sets I loved"
                style={{
                  padding: "0.5rem 0.6rem",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                }}
              />
            </label>

            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={newIsPublic}
                onChange={(e) => setNewIsPublic(e.target.checked)}
              />
              <span style={{ fontSize: "0.9rem", color: "#333" }}>
                Public (shows up in Explore)
              </span>
            </label>

            {createErr && <div style={{ color: "red" }}>{createErr}</div>}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                disabled={creating}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: "none",
                  background: creating ? "#888" : "#111827",
                  color: "white",
                  cursor: creating ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {creating ? "Creating…" : "Create"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setCreateErr(null);
                }}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {!isLoggedIn && (
        <p style={{ marginTop: "0.75rem", color: "#777" }}>
          Log in to create and view your custom lists here.
        </p>
      )}

      {loading && <p>Loading collection…</p>}
      {error && <p style={{ color: "red" }}>Error loading collection: {error}</p>}

      {myListsLoadError && <p style={{ color: "red" }}>Error loading lists: {myListsLoadError}</p>}
      {reorderError && <p style={{ color: "red" }}>Reorder error: {reorderError}</p>}
      {deleteError && <p style={{ color: "red" }}>Delete error: {deleteError}</p>}

      {!loading && !error && !hasAny && (
        <p style={{ marginTop: "1rem", color: "#777" }}>
          You haven&apos;t marked any sets as Owned or added them to your Wishlist yet.
        </p>
      )}

      {/* Owned */}
      <CollectionRow
        title="Owned"
        totalCount={ownedNums.length}
        sets={ownedDetails}
        viewAllLabel="View all"
        onViewAll={() => navigate("/collection/owned")}
        emptyText="No owned sets yet."
      />

      {/* Wishlist */}
      <CollectionRow
        title="Wishlist"
        totalCount={wishlistNums.length}
        sets={wishlistDetails}
        viewAllLabel="View all"
        onViewAll={() => navigate("/collection/wishlist")}
        emptyText="No wishlist sets yet."
      />

      {/* Custom lists */}
      {isLoggedIn && (
        <>
          {myListsLoading && <p style={{ marginTop: "1.25rem" }}>Loading your lists…</p>}

          {!myListsLoading && !myListsLoadError && myLists.length === 0 && (
            <p style={{ marginTop: "1.25rem", color: "#777" }}>
              No custom lists yet. Click <strong>Create list</strong> to make one.
            </p>
          )}

          {!myListsLoading &&
            !myListsLoadError &&
            myLists.length > 0 &&
            myLists.map((l, idx) => {
              const count =
                l?.items_count ?? (Array.isArray(l?.items) ? l.items.length : 0);
              const sets = listPreviewSets[l.id] || [];

              const desktopReorderButtons = (
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <button
                    type="button"
                    onClick={() => moveListDesktop(l.id, -1)}
                    disabled={reorderSaving || idx === 0}
                    title="Move up"
                    style={{
                      padding: "0.25rem 0.55rem",
                      borderRadius: "999px",
                      border: "1px solid #ddd",
                      background: "white",
                      cursor: reorderSaving || idx === 0 ? "not-allowed" : "pointer",
                      opacity: reorderSaving || idx === 0 ? 0.5 : 1,
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveListDesktop(l.id, +1)}
                    disabled={reorderSaving || idx === myLists.length - 1}
                    title="Move down"
                    style={{
                      padding: "0.25rem 0.55rem",
                      borderRadius: "999px",
                      border: "1px solid #ddd",
                      background: "white",
                      cursor:
                        reorderSaving || idx === myLists.length - 1
                          ? "not-allowed"
                          : "pointer",
                      opacity: reorderSaving || idx === myLists.length - 1 ? 0.5 : 1,
                    }}
                  >
                    ↓
                  </button>
                </div>
              );

              const actions = (
                <div
                  style={{
                    display: "flex",
                    gap: "0.35rem",
                    alignItems: "center",
                    position: "relative",
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {!isMobile && desktopReorderButtons}

                  <ListMenuButton
                    open={menuOpenFor === l.id}
                    onToggle={() =>
                      setMenuOpenFor((prev) => (prev === l.id ? null : l.id))
                    }
                  />

                  {menuOpenFor === l.id && (
                    <ListMenuDropdown
                      onEdit={() => openEditForList(l)}
                      onDelete={() => handleDeleteList(l)}
                    />
                  )}
                </div>
              );

              return (
                <CollectionRow
                  key={l.id}
                  title={l.title}
                  totalCount={count}
                  sets={sets}
                  viewAllLabel="View all"
                  onViewAll={() => navigate(`/lists/${l.id}`)}
                  emptyText="No sets in this list yet."
                  rightActions={actions}
                />
              );
            })}
        </>
      )}

      {/* Mobile reorder sheet */}
      <ReorderSheet
        open={showReorderSheet}
        onClose={() => setShowReorderSheet(false)}
        draftLists={draftLists}
        setDraftLists={setDraftLists}
        onSave={saveReorderSheet}
        saving={reorderSaving}
        error={reorderError}
      />

      {/* Edit modal */}
      <EditListModal
        open={editOpen}
        title={editTitle}
        setTitle={setEditTitle}
        desc={editDesc}
        setDesc={setEditDesc}
        isPublic={editIsPublic}
        setIsPublic={setEditIsPublic}
        saving={editSaving}
        error={editError}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}