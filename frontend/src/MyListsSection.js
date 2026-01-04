// frontend/src/MyListsSection.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function getStoredToken() {
  return localStorage.getItem("lego_token") || "";
}

function safeCount(list) {
  const c = list?.items_count ?? (Array.isArray(list?.items) ? list.items.length : 0);
  return Number.isFinite(c) ? c : 0;
}

function sortByPositionThenId(a, b) {
  const pa = Number.isFinite(a?.position) ? a.position : 999999;
  const pb = Number.isFinite(b?.position) ? b.position : 999999;
  if (pa !== pb) return pa - pb;
  return (a?.id ?? 0) - (b?.id ?? 0);
}

export default function MyListsSection({ token }) {
  const effectiveToken = token || getStoredToken();
  const isLoggedIn = !!effectiveToken;

  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // reorder save state
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderErr, setOrderErr] = useState(null);

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState(null);

  const sortedLists = useMemo(() => {
    return [...lists].sort(sortByPositionThenId);
  }, [lists]);

  async function loadMyLists() {
    if (!isLoggedIn) return;

    try {
      setLoading(true);
      setErr(null);

      const resp = await fetch(`${API_BASE}/lists/me`, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to load my lists (${resp.status}): ${text}`);
      }

      const data = await resp.json();
      const arr = Array.isArray(data) ? data : [];
      // keep local state exactly as API gives, but stable-sort for UI
      setLists(arr);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveToken]);

  async function saveOrder(nextOrdered) {
    // nextOrdered is already sorted in the desired order (top -> bottom)
    setSavingOrder(true);
    setOrderErr(null);

    try {
      const orderedIds = nextOrdered
        .filter((l) => !l.is_system)
        .map((l) => l.id);

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

      const updated = await resp.json();
      // backend returns updated positions; keep it
      setLists(Array.isArray(updated) ? updated : nextOrdered);
    } catch (e) {
      setOrderErr(e?.message || String(e));
      // reload from server to revert if needed
      await loadMyLists();
    } finally {
      setSavingOrder(false);
    }
  }

  function moveIndex(fromIndex, toIndex) {
    const next = [...sortedLists];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    // optimistic UI update immediately
    setLists(next);
    saveOrder(next);
    setOrderErr(null);
  }

  function handleMoveUp(id) {
    const idx = sortedLists.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    moveIndex(idx, idx - 1);
  }

  function handleMoveDown(id) {
    const idx = sortedLists.findIndex((l) => l.id === id);
    if (idx === -1 || idx >= sortedLists.length - 1) return;
    moveIndex(idx, idx + 1);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!isLoggedIn) return;

    const t = title.trim();
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
          description: description.trim() || null,
          is_public: !!isPublic,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Create list failed (${resp.status}): ${text}`);
      }

      // Better than guessing positions: just reload from server
      setTitle("");
      setDescription("");
      setIsPublic(true);
      setShowCreate(false);
      await loadMyLists();
    } catch (e2) {
      setCreateErr(e2?.message || String(e2));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section style={{ marginTop: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>My Lists</h2>
          <p style={{ margin: "0.25rem 0 0 0", color: "#666" }}>
            Create custom lists like “Top 10”, “To build”, “Favorite castles”, etc.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate((p) => !p)}
          disabled={!isLoggedIn}
          style={{
            padding: "0.4rem 0.8rem",
            borderRadius: "999px",
            border: "1px solid #ddd",
            background: "white",
            cursor: isLoggedIn ? "pointer" : "not-allowed",
            opacity: isLoggedIn ? 1 : 0.6,
          }}
        >
          {showCreate ? "Close" : "➕ New list"}
        </button>
      </div>

      {!isLoggedIn && (
        <p style={{ marginTop: "0.75rem", color: "#777" }}>
          Log in to create and view your lists.
        </p>
      )}

      {showCreate && isLoggedIn && (
        <form
          onSubmit={handleCreate}
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span style={{ fontSize: "0.9rem", color: "#333" }}>
                Public (shows up in Explore later)
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
                {creating ? "Creating…" : "Create list"}
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

      {isLoggedIn && (
        <div style={{ marginTop: "0.9rem" }}>
          {loading && <p>Loading your lists…</p>}
          {err && <p style={{ color: "red" }}>Error: {err}</p>}
          {savingOrder && <p style={{ color: "#666" }}>Saving order…</p>}
          {orderErr && <p style={{ color: "red" }}>Order error: {orderErr}</p>}

          {!loading && !err && sortedLists.length === 0 && (
            <p style={{ color: "#777" }}>
              No lists yet. Click <strong>New list</strong> to create one.
            </p>
          )}

          {!loading && !err && sortedLists.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
              {sortedLists.map((l, idx) => {
                const count = safeCount(l);
                const disableUp = idx === 0 || savingOrder;
                const disableDown = idx === sortedLists.length - 1 || savingOrder;

                return (
                  <li
                    key={l.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      background: "white",
                      padding: "0.9rem",
                      display: "flex",
                      gap: "0.75rem",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                    }}
                  >
                    {/* Main clickable content */}
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <Link
                        to={`/lists/${l.id}`}
                        style={{ textDecoration: "none", color: "inherit", display: "block" }}
                      >
                        <div style={{ fontWeight: 700 }}>{l.title}</div>

                        {l.description && (
                          <div style={{ color: "#666", marginTop: "0.15rem" }}>
                            {l.description}
                          </div>
                        )}

                        <div style={{ color: "#777", marginTop: "0.35rem", fontSize: "0.9rem" }}>
                          {count} set{count === 1 ? "" : "s"} · {l.is_public ? "Public" : "Private"}
                        </div>
                      </Link>
                    </div>

                    {/* Reorder controls */}
                    <div style={{ display: "grid", gap: "0.35rem", flex: "0 0 auto" }}>
                      <button
                        type="button"
                        onClick={() => handleMoveUp(l.id)}
                        disabled={disableUp}
                        title="Move up"
                        style={{
                          width: "36px",
                          height: "30px",
                          borderRadius: "10px",
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: disableUp ? "default" : "pointer",
                          opacity: disableUp ? 0.5 : 1,
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(l.id)}
                        disabled={disableDown}
                        title="Move down"
                        style={{
                          width: "36px",
                          height: "30px",
                          borderRadius: "10px",
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: disableDown ? "default" : "pointer",
                          opacity: disableDown ? 0.5 : 1,
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && (
            <button
              type="button"
              onClick={loadMyLists}
              style={{
                marginTop: "0.75rem",
                padding: "0.35rem 0.8rem",
                borderRadius: "999px",
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Refresh
            </button>
          )}
        </div>
      )}
    </section>
  );
}