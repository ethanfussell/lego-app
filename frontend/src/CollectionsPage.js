// frontend/src/CollectionsPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "./Toast";
import SetCard from "./SetCard";

const API_BASE = "http://localhost:8000";
const PREVIEW_COUNT = 10;

const LS_COLLECTION_SECTION_ORDER = "lego_collection_section_order_v1";

// ---------------- utils ----------------
function getStoredToken() {
  try {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("lego_token") || "";
  } catch {
    return "";
  }
}

async function fetchSetDetail(setNum, token) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const resp = await fetch(`${API_BASE}/sets/${encodeURIComponent(setNum)}`, { headers });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function fetchListDetail(listId, token) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const resp = await fetch(`${API_BASE}/lists/${encodeURIComponent(listId)}`, { headers });
    if (!resp.ok) return null;
    return await resp.json(); // has .items
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

function readJson(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function makeKeyForListId(id) {
  return `list:${id}`;
}

function normalizeOrder(savedOrder, listsNow) {
  const listKeysNow = (listsNow || []).map((l) => makeKeyForListId(l.id));

  const base = Array.isArray(savedOrder) ? savedOrder : [];
  const cleaned = [];

  for (const k of base) {
    if (k === "owned" || k === "wishlist") cleaned.push(k);
    else if (typeof k === "string" && k.startsWith("list:") && listKeysNow.includes(k)) cleaned.push(k);
  }

  if (!cleaned.includes("owned")) cleaned.unshift("owned");
  if (!cleaned.includes("wishlist")) {
    const ownedIdx = cleaned.indexOf("owned");
    cleaned.splice(Math.max(ownedIdx + 1, 0), 0, "wishlist");
  }

  for (const lk of listKeysNow) {
    if (!cleaned.includes(lk)) cleaned.push(lk);
  }

  return cleaned;
}

// ---------------- main page ----------------
export default function CollectionsPage({ ownedSets = [], wishlistSets = [], token }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { push: toast } = useToast();

  const isMobile = useIsMobile(720);

  const effectiveToken = token || getStoredToken();
  const isLoggedIn = !!effectiveToken;

  // Accept arrays OR Sets OR array-of-objects
  const ownedNums = useMemo(() => {
    const src = ownedSets instanceof Set ? Array.from(ownedSets) : ownedSets || [];
    return src.map((x) => (typeof x === "string" ? x : x?.set_num)).filter(Boolean);
  }, [ownedSets]);

  const wishlistNums = useMemo(() => {
    const src = wishlistSets instanceof Set ? Array.from(wishlistSets) : wishlistSets || [];
    return src.map((x) => (typeof x === "string" ? x : x?.set_num)).filter(Boolean);
  }, [wishlistSets]);

  // ---------------- Create list modal via ?create=1 ----------------
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setCreateOpen(params.get("create") === "1");
  }, [location.search]);

  function openCreate() {
    if (!isLoggedIn) {
      toast?.("Log in to create lists.");
      navigate("/login");
      return;
    }
    navigate("/collection?create=1");
  }

  function closeCreate() {
    setCreateErr(null);
    setNewTitle("");
    navigate("/collection", { replace: true });
  }

  // ---------------- Menu + edit/delete state ----------------
  const [menuOpenFor, setMenuOpenFor] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    function onDocMouseDown() {
      setMenuOpenFor(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // ---------------- API helpers ----------------
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

    try {
      return await resp.json();
    } catch {
      return null;
    }
  }

  async function fetchMyLists() {
    if (!isLoggedIn) return [];

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

  // ---------------- Previews: owned/wishlist ----------------
  const [ownedDetails, setOwnedDetails] = useState([]);
  const [wishlistDetails, setWishlistDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [collectionError, setCollectionError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOwnedWishlist() {
      try {
        setLoading(true);
        setCollectionError(null);

        const [ownedFull, wishlistFull] = await Promise.all([
          Promise.all(ownedNums.slice(0, PREVIEW_COUNT).map((n) => fetchSetDetail(n, effectiveToken))),
          Promise.all(wishlistNums.slice(0, PREVIEW_COUNT).map((n) => fetchSetDetail(n, effectiveToken))),
        ]);

        if (!cancelled) {
          setOwnedDetails(ownedFull.filter(Boolean));
          setWishlistDetails(wishlistFull.filter(Boolean));
        }
      } catch (err) {
        if (!cancelled) setCollectionError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOwnedWishlist();
    return () => {
      cancelled = true;
    };
  }, [ownedNums, wishlistNums, effectiveToken]);

  // ---------------- Lists ----------------
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

  // You said you're filtering out Owned/Wishlist “system lists” from custom lists:
  function isSystemList(l) {
    if (!l) return false;
    if (l.is_system || l.isSystem || l.system) return true;

    const key = String(l.system_key || l.kind || l.type || "").toLowerCase();
    if (key === "owned" || key === "wishlist") return true;

    const title = String(l.title || "").trim().toLowerCase();
    if (title === "owned" || title === "wishlist") return true;

    return false;
  }

  // Load my lists
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
        const customOnly = (Array.isArray(data) ? data : []).filter((l) => !isSystemList(l));

        if (!cancelled) setMyLists(customOnly);
      } catch (e) {
        if (!cancelled) setMyListsLoadError(e?.message || String(e));
      } finally {
        if (!cancelled) setMyListsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [effectiveToken, isLoggedIn]);

// Load preview set cards for each list
useEffect(() => {
  let cancelled = false;

  async function loadListPreviews() {
    if (!myLists || myLists.length === 0) {
      setListPreviewSets({});
      return;
    }

    try {
      const entries = await Promise.all(
        myLists.map(async (l) => {
          // ✅ Get the real items from /lists/:id
          const detail = await fetchListDetail(l.id, effectiveToken);
          const items = Array.isArray(detail?.items) ? detail.items : [];

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
    } catch {
      if (!cancelled) setListPreviewSets({});
    }
  }

  loadListPreviews();
  return () => {
    cancelled = true;
  };
}, [myLists, effectiveToken]);

  // ---------------- Create list (modal submit) ----------------
  async function submitCreateList(e) {
    e.preventDefault();
    if (!isLoggedIn) return;

    const title = newTitle.trim();
    if (!title) {
      setCreateErr("Please enter a list name.");
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
          title,
          description: null,
          is_public: true,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Create list failed (${resp.status}): ${text}`);
      }

      const created = await resp.json();

      const optimistic = [created, ...myListsRef.current];
      setMyLists(optimistic);

      setReorderSaving(true);
      try {
        const saved = await persistListOrder(optimistic);
        setMyLists(saved);
      } finally {
        setReorderSaving(false);
      }

      toast?.("List created!");
      closeCreate();
    } catch (err) {
      setCreateErr(err?.message || String(err));
    } finally {
      setCreating(false);
    }
  }

  // ---------------- Edit/Delete ----------------
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

      if (remaining.length > 0) {
        try {
          const saved = await persistListOrder(remaining);
          setMyLists(saved);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setDeleteError(err?.message || String(err));
    }
  }

  // ---------------- Desktop reorder (custom lists only) ----------------
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

  // ---------------- Section order (Owned/Wishlist + Lists) ----------------
  const [sectionOrder, setSectionOrder] = useState(() =>
    readJson(LS_COLLECTION_SECTION_ORDER, ["owned", "wishlist"])
  );

  useEffect(() => {
    writeJson(LS_COLLECTION_SECTION_ORDER, sectionOrder);
  }, [sectionOrder]);

  const orderedSectionKeys = useMemo(() => {
    const listsNow = isLoggedIn ? myLists : [];
    return normalizeOrder(sectionOrder, listsNow);
  }, [sectionOrder, myLists, isLoggedIn]);

  const listIndexById = useMemo(() => {
    const map = {};
    (myLists || []).forEach((l, idx) => {
      map[String(l.id)] = idx;
    });
    return map;
  }, [myLists]);

  // ---------------- Mobile reorder sheet ----------------
  const [showReorderSheet, setShowReorderSheet] = useState(false);
  const [draftLists, setDraftLists] = useState([]);

  function buildDraftFromKeys(keys) {
    return (keys || []).map((k) => {
      if (k === "owned") {
        return { id: "owned", title: "Owned", meta: `${ownedNums.length === 1 ? "1 set" : `${ownedNums.length} sets`}` };
      }
      if (k === "wishlist") {
        return { id: "wishlist", title: "Wishlist", meta: `${wishlistNums.length === 1 ? "1 set" : `${wishlistNums.length} sets`}` };
      }

      const listId = String(k).slice("list:".length);
      const l = (myListsRef.current || []).find((x) => String(x.id) === String(listId));
      const count = l?.items_count ?? (Array.isArray(l?.items) ? l.items.length : 0);

      return {
        id: k,
        title: l?.title || `List ${listId}`,
        meta: `${count === 1 ? "1 set" : `${count} sets`} · ${l?.is_public ? "Public" : "Private"}`,
      };
    });
  }

  function openReorder() {
    setReorderError(null);
    setDraftLists(buildDraftFromKeys(orderedSectionKeys));
    setShowReorderSheet(true);
  }

  async function saveReorderSheet() {
    if (!isLoggedIn || reorderSaving) return;

    const prevLists = myListsRef.current;
    const nextKeys = (draftLists || []).map((x) => x.id);

    setSectionOrder(nextKeys);

    const listIdsInOrder = nextKeys
      .filter((k) => typeof k === "string" && k.startsWith("list:"))
      .map((k) => k.slice("list:".length));

    const nextLists = listIdsInOrder
      .map((id) => prevLists.find((l) => String(l.id) === String(id)))
      .filter(Boolean);

    setMyLists(nextLists);

    try {
      setReorderSaving(true);
      const saved = await persistListOrder(nextLists);
      setMyLists(saved);
      setShowReorderSheet(false);
    } catch (e) {
      setMyLists(prevLists);
      setReorderError(e?.message || String(e));
    } finally {
      setReorderSaving(false);
    }
  }

  const hasAny = ownedDetails.length > 0 || wishlistDetails.length > 0 || (myLists && myLists.length > 0);
  const showReorderButton = isLoggedIn && orderedSectionKeys.length > 1;

  function renderSectionRow(key) {
    if (key === "owned") {
      return (
        <CollectionRow
          key="owned"
          title="Owned"
          totalCount={ownedNums.length}
          sets={ownedDetails}
          viewAllLabel="View all"
          onViewAll={() => navigate("/collection/owned")}
          emptyText="No owned sets yet."
          cardProps={{ collectionFooter: "rating" }}
        />
      );
    }

    if (key === "wishlist") {
      return (
        <CollectionRow
          key="wishlist"
          title="Wishlist"
          totalCount={wishlistNums.length}
          sets={wishlistDetails}
          viewAllLabel="View all"
          onViewAll={() => navigate("/collection/wishlist")}
          emptyText="No wishlist sets yet."
          cardProps={{ collectionFooter: "shop" }}
        />
      );
    }

    if (typeof key === "string" && key.startsWith("list:")) {
      const listId = key.slice("list:".length);
      const l = myLists.find((x) => String(x.id) === String(listId));
      if (!l) return null;

      const idx = listIndexById[String(l.id)] ?? myLists.findIndex((x) => x.id === l.id);
      const count = l?.items_count ?? (Array.isArray(l?.items) ? l.items.length : 0);
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
              cursor: reorderSaving || idx === myLists.length - 1 ? "not-allowed" : "pointer",
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
            onToggle={() => setMenuOpenFor((prev) => (prev === l.id ? null : l.id))}
          />

          {menuOpenFor === l.id && (
            <ListMenuDropdown onEdit={() => openEditForList(l)} onDelete={() => handleDeleteList(l)} />
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
    }

    return null;
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
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
            onClick={openCreate}
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

      {!isLoggedIn && (
        <p style={{ marginTop: "0.75rem", color: "#777" }}>
          Log in to create and view your custom lists here.
        </p>
      )}

      {loading && <p>Loading collection…</p>}
      {collectionError && <p style={{ color: "red" }}>Error loading collection: {collectionError}</p>}

      {myListsLoadError && <p style={{ color: "red" }}>Error loading lists: {myListsLoadError}</p>}
      {reorderError && <p style={{ color: "red" }}>Reorder error: {reorderError}</p>}
      {deleteError && <p style={{ color: "red" }}>Delete error: {deleteError}</p>}

      {!loading && !collectionError && !hasAny && (
        <p style={{ marginTop: "1rem", color: "#777" }}>
          You haven&apos;t marked any sets as Owned or added them to your Wishlist yet.
        </p>
      )}

      {/* ✅ Create list modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 15000,
            display: "grid",
            placeItems: "center",
            padding: "1rem",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCreate();
          }}
        >
          <form
            onSubmit={submitCreateList}
            style={{
              width: "min(420px, 100%)",
              background: "white",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              boxShadow: "0 12px 35px rgba(0,0,0,0.18)",
              padding: "1rem",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>Create a new list</div>

            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Favorite builds"
              autoFocus
              style={{
                width: "100%",
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}
            />

            {createErr && (
              <div style={{ marginTop: 10, color: "#b42318", fontWeight: 700, fontSize: "0.9rem" }}>
                {createErr}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={closeCreate}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: "999px",
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: "999px",
                  border: "none",
                  background: creating ? "#6b7280" : "#111827",
                  color: "white",
                  cursor: creating ? "default" : "pointer",
                  fontWeight: 900,
                }}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoggedIn && myListsLoading && <p style={{ marginTop: "1.25rem" }}>Loading your lists…</p>}

      {isLoggedIn && !myListsLoading && !myListsLoadError && myLists.length === 0 && (
        <p style={{ marginTop: "1.25rem", color: "#777" }}>
          No custom lists yet. Click <strong>Create list</strong> to make one.
        </p>
      )}

      {/* ✅ Render in chosen order */}
      {orderedSectionKeys.map(renderSectionRow)}

      <ReorderSheet
        open={showReorderSheet}
        onClose={() => setShowReorderSheet(false)}
        draftLists={draftLists}
        setDraftLists={setDraftLists}
        onSave={saveReorderSheet}
        saving={reorderSaving}
        error={reorderError}
      />

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

// ---------------- UI: reusable horizontal row (WITH ARROWS) ----------------
function CollectionRow({
  title,
  totalCount,
  sets,
  viewAllLabel,
  onViewAll,
  emptyText,
  rightActions,
  cardProps = {},
}) {
  const preview = Array.isArray(sets) ? sets.slice(0, PREVIEW_COUNT) : [];

  const scrollerRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function updateArrows() {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft < maxScrollLeft - 2);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.length]);

  function scrollByDir(dir) {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.85);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

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
        <div style={{ position: "relative" }}>
          {/* Left arrow */}
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            disabled={!canLeft}
            aria-label="Scroll left"
            title="Scroll left"
            style={{
              position: "absolute",
              left: -6,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 5,
              width: 34,
              height: 34,
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: canLeft ? "pointer" : "not-allowed",
              opacity: canLeft ? 1 : 0.35,
              display: "grid",
              placeItems: "center",
            }}
          >
            ‹
          </button>

          {/* Right arrow */}
          <button
            type="button"
            onClick={() => scrollByDir(+1)}
            disabled={!canRight}
            aria-label="Scroll right"
            title="Scroll right"
            style={{
              position: "absolute",
              right: -6,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 5,
              width: 34,
              height: 34,
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: canRight ? "pointer" : "not-allowed",
              opacity: canRight ? 1 : 0.35,
              display: "grid",
              placeItems: "center",
            }}
          >
            ›
          </button>

          {/* Scroll area */}
          <div
            ref={scrollerRef}
            style={{
              overflowX: "auto",
              paddingBottom: "0.5rem",
              scrollBehavior: "smooth",
              paddingLeft: 18,
              paddingRight: 18,
            }}
          >
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                gap: "0.75rem",
                alignItems: "stretch",
              }}
            >
              {preview.map((set, idx) => (
                <li
                  key={set?.set_num ? `${set.set_num}-${idx}` : `${title}-${idx}`}
                  style={{
                    minWidth: "220px",
                    maxWidth: "220px",
                    flex: "0 0 auto",
                    display: "flex",
                  }}
                >
                  <SetCard set={set} variant="collection" {...cardProps} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------- UI: mobile reorder sheet ----------------
function ReorderSheet({ open, onClose, draftLists, setDraftLists, onSave, saving, error }) {
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
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Reorder sections</div>
            <div style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.15rem" }}>
              Move Owned / Wishlist / Lists up/down, then hit Save.
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
                  {l.meta || ""}
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
                    cursor: saving || idx === draftLists.length - 1 ? "not-allowed" : "pointer",
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
      onMouseDown={(e) => e.stopPropagation()}
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
            <span style={{ fontSize: "0.9rem", color: "#333" }}>Description (optional)</span>
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
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <span style={{ fontSize: "0.9rem", color: "#333" }}>Public (shows up in Explore)</span>
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