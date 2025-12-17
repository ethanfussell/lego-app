// frontend/src/CollectionsPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SetCard from "./SetCard";

const API_BASE = "http://localhost:8000";

function getStoredToken() {
  return localStorage.getItem("lego_token") || "";
}

async function fetchSetDetail(setNum) {
  try {
    const resp = await fetch(`${API_BASE}/sets/${encodeURIComponent(setNum)}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

function CollectionRow({
  title,
  totalCount,
  sets,
  viewAllLabel,
  onViewAll,
  emptyText,
  rightControls, // <-- NEW (optional)
}) {
  const preview = Array.isArray(sets) ? sets.slice(0, 10) : []; // you set 10 👍

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

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {rightControls ? (
            rightControls
          ) : (
            <button
              type="button"
              onClick={onViewAll}
              style={{
                padding: "0.35rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid #ddd",
                background: "white",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {viewAllLabel}
            </button>
          )}
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
                style={{
                  minWidth: "220px",
                  maxWidth: "220px",
                  flex: "0 0 auto",
                }}
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

export default function CollectionsPage({ ownedSets = [], wishlistSets = [], token }) {
  const navigate = useNavigate();

  const effectiveToken = token || getStoredToken();
  const isLoggedIn = !!effectiveToken;

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

  const [ownedDetails, setOwnedDetails] = useState([]);
  const [wishlistDetails, setWishlistDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [myLists, setMyLists] = useState([]);
  const [myListsLoading, setMyListsLoading] = useState(false);
  const [myListsError, setMyListsError] = useState(null);
  const [listPreviewSets, setListPreviewSets] = useState({}); // { [listId]: [setObj,...] }

  // reorder save state
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState(null);

  // Create list UI
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState(null);

  // -------------------------
  // Load owned/wishlist previews
  // -------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadOwnedWishlist() {
      try {
        setLoading(true);
        setError(null);

        const [ownedFull, wishlistFull] = await Promise.all([
          Promise.all(ownedNums.map(fetchSetDetail)),
          Promise.all(wishlistNums.map(fetchSetDetail)),
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
  }, [ownedNums, wishlistNums]);

  // -------------------------
  // Load my lists
  // -------------------------
  async function loadMyLists() {
    if (!isLoggedIn) {
      setMyLists([]);
      setListPreviewSets({});
      return;
    }

    try {
      setMyListsLoading(true);
      setMyListsError(null);

      const resp = await fetch(`${API_BASE}/lists/me`, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to load my lists (${resp.status}): ${text}`);
      }

      const data = await resp.json();
      setMyLists(Array.isArray(data) ? data : []);
    } catch (e) {
      setMyListsError(e?.message || String(e));
    } finally {
      setMyListsLoading(false);
    }
  }

  useEffect(() => {
    loadMyLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveToken, isLoggedIn]);

  // -------------------------
  // Load preview sets for each list (first 10 items)
  // -------------------------
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
          const first = items.slice(0, 10);
          const full = await Promise.all(first.map(fetchSetDetail));
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
  }, [myLists]);

  // -------------------------
  // Save order to backend
  // -------------------------
  async function persistOrder(nextLists) {
    if (!isLoggedIn) return;

    setSavingOrder(true);
    setOrderError(null);

    try {
      const orderedIds = nextLists.map((l) => l.id);

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

      // backend returns the lists
      const updated = await resp.json();
      setMyLists(Array.isArray(updated) ? updated : nextLists);
    } catch (e) {
      setOrderError(e?.message || String(e));
      throw e;
    } finally {
      setSavingOrder(false);
    }
  }

  async function moveList(listId, direction) {
    // direction: -1 for up, +1 for down
    const idx = myLists.findIndex((l) => l.id === listId);
    if (idx === -1) return;

    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= myLists.length) return;

    const prev = myLists;
    const next = [...myLists];
    const tmp = next[idx];
    next[idx] = next[nextIdx];
    next[nextIdx] = tmp;

    // optimistic UI
    setMyLists(next);

    try {
      await persistOrder(next);
    } catch {
      // revert if backend fails
      setMyLists(prev);
    }
  }

  // -------------------------
  // Create list (then optionally pin it to top by saving order)
  // -------------------------
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

      // Put it at the top locally...
      const next = [created, ...myLists];
      setMyLists(next);

      // ...and make the server match that order.
      await persistOrder(next);

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

  const hasAny =
    ownedDetails.length > 0 ||
    wishlistDetails.length > 0 ||
    (myLists && myLists.length > 0);

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header + Create list button */}
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
                  cursor: creating ? "default" : "pointer",
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

      {orderError && (
        <p style={{ color: "red", marginTop: "0.75rem" }}>
          Order save error: {orderError}
        </p>
      )}

      {!loading && !error && !hasAny && (
        <p style={{ marginTop: "1rem", color: "#777" }}>
          You haven&apos;t marked any sets as Owned or added them to your Wishlist yet.
        </p>
      )}

      <CollectionRow
        title="Owned"
        totalCount={ownedDetails.length}
        sets={ownedDetails}
        viewAllLabel="View all"
        onViewAll={() => navigate("/collection/owned")}
        emptyText="No owned sets yet."
      />

      <CollectionRow
        title="Wishlist"
        totalCount={wishlistDetails.length}
        sets={wishlistDetails}
        viewAllLabel="View all"
        onViewAll={() => navigate("/collection/wishlist")}
        emptyText="No wishlist sets yet."
      />

      {/* Custom lists */}
      {isLoggedIn && (
        <>
          {myListsLoading && <p style={{ marginTop: "1.25rem" }}>Loading your lists…</p>}
          {myListsError && <p style={{ color: "red" }}>Error: {myListsError}</p>}

          {!myListsLoading && !myListsError && myLists.length === 0 && (
            <p style={{ marginTop: "1.25rem", color: "#777" }}>
              No custom lists yet. Click <strong>Create list</strong> to make one.
            </p>
          )}

          {!myListsLoading &&
            !myListsError &&
            myLists.length > 0 &&
            myLists.map((l, idx) => {
              const count =
                l.items_count ?? (Array.isArray(l.items) ? l.items.length : 0);
              const sets = listPreviewSets[l.id] || [];

              return (
                <CollectionRow
                  key={l.id}
                  title={l.title}
                  totalCount={count}
                  sets={sets}
                  emptyText="No sets in this list yet."
                  rightControls={
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`/lists/${l.id}`)}
                        style={{
                          padding: "0.35rem 0.9rem",
                          borderRadius: "999px",
                          border: "1px solid #ddd",
                          background: "white",
                          fontSize: "0.85rem",
                          cursor: "pointer",
                        }}
                      >
                        View all
                      </button>

                      <button
                        type="button"
                        disabled={savingOrder || idx === 0}
                        onClick={() => moveList(l.id, -1)}
                        style={{
                          padding: "0.35rem 0.65rem",
                          borderRadius: "999px",
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: savingOrder || idx === 0 ? "not-allowed" : "pointer",
                          opacity: savingOrder || idx === 0 ? 0.5 : 1,
                          fontSize: "0.85rem",
                        }}
                        title="Move up"
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        disabled={savingOrder || idx === myLists.length - 1}
                        onClick={() => moveList(l.id, +1)}
                        style={{
                          padding: "0.35rem 0.65rem",
                          borderRadius: "999px",
                          border: "1px solid #ddd",
                          background: "white",
                          cursor:
                            savingOrder || idx === myLists.length - 1
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            savingOrder || idx === myLists.length - 1 ? 0.5 : 1,
                          fontSize: "0.85rem",
                        }}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </>
                  }
                />
              );
            })}
        </>
      )}
    </div>
  );
}