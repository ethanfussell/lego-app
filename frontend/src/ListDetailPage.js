// frontend/src/ListDetailPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import SetCard from "./SetCard";

const API_BASE = "http://localhost:8000";

function getStoredToken() {
  return localStorage.getItem("lego_token") || "";
}

function getUsernameFromToken(token) {
  if (!token) return null;
  const prefix = "fake-token-for-";
  if (token.startsWith(prefix)) return token.slice(prefix.length);
  return token;
}

async function apiFetch(path, { token, ...opts } = {}) {
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

async function fetchSetDetail(setNum, token) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const resp = await fetch(`${API_BASE}/sets/${encodeURIComponent(setNum)}`, { headers });
    if (!resp.ok) return null;
    return await resp.json(); // includes user_rating when token provided
  } catch {
    return null;
  }
}

function countForList(list) {
  const c = list?.items_count ?? (Array.isArray(list?.items) ? list.items.length : 0);
  return Number.isFinite(c) ? c : 0;
}

export default function ListDetailPage({
  token,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const { listId } = useParams();
  const navigate = useNavigate();

  const effectiveToken = token || getStoredToken();
  const currentUsername = useMemo(() => getUsernameFromToken(effectiveToken), [effectiveToken]);

  const [list, setList] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [setDetails, setSetDetails] = useState([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [setsError, setSetsError] = useState(null);

  // owner-only editing
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);

  const [removing, setRemoving] = useState(null); // set_num being removed
  const [removeError, setRemoveError] = useState(null);

  // delete list
  const [deletingList, setDeletingList] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const isOwner = !!list?.owner && !!currentUsername && list.owner === currentUsername;

  async function loadList() {
    if (!listId) return null;

    setListLoading(true);
    setListError(null);

    try {
      const resp = await fetch(`${API_BASE}/lists/${encodeURIComponent(listId)}`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to load list (${resp.status}): ${text}`);
      }
      const data = await resp.json();
      setList(data);
      return data;
    } catch (err) {
      setList(null);
      setSetDetails([]);
      setListError(err?.message || String(err));
      return null;
    } finally {
      setListLoading(false);
    }
  }

  async function loadSetCards(listData) {
    const items = Array.isArray(listData?.items) ? listData.items : [];

    setSetsLoading(true);
    setSetsError(null);

    try {
      // one request per set, includes user_rating when logged in
      const results = await Promise.all(items.map((n) => fetchSetDetail(n, effectiveToken)));
      const ok = results.filter(Boolean);

      if (ok.length !== items.length && items.length > 0) {
        setSetsError(`Loaded ${ok.length}/${items.length} sets (some set numbers may not exist yet).`);
      }

      setSetDetails(ok);
    } catch (err) {
      setSetDetails([]);
      setSetsError(err?.message || String(err));
    } finally {
      setSetsLoading(false);
    }
  }

  async function loadAll() {
    const data = await loadList();
    if (data) await loadSetCards(data);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadAll();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, effectiveToken]);

  async function handleAddItem(e) {
    e.preventDefault();
    setAddError(null);
    setRemoveError(null);
    setDeleteError(null);

    const setNum = addValue.trim();
    if (!setNum) return;

    if (!effectiveToken) {
      setAddError("Log in to edit your list.");
      navigate("/login");
      return;
    }
    if (!isOwner) {
      setAddError("Only the list owner can add items.");
      return;
    }

    try {
      setAdding(true);

      const resp = await apiFetch(`/lists/${encodeURIComponent(listId)}/items`, {
        token: effectiveToken,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set_num: setNum }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Add failed (${resp.status}): ${text}`);
      }

      setAddValue("");
      await loadAll();
    } catch (err) {
      setAddError(err?.message || String(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveItem(setNum) {
    setRemoveError(null);
    setAddError(null);
    setDeleteError(null);

    if (!effectiveToken) {
      setRemoveError("Log in to edit your list.");
      navigate("/login");
      return;
    }
    if (!isOwner) {
      setRemoveError("Only the list owner can remove items.");
      return;
    }

    try {
      setRemoving(setNum);

      const resp = await apiFetch(
        `/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(setNum)}`,
        { token: effectiveToken, method: "DELETE" }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Remove failed (${resp.status}): ${text}`);
      }

      await loadAll();
    } catch (err) {
      setRemoveError(err?.message || String(err));
    } finally {
      setRemoving(null);
    }
  }

  async function handleDeleteList() {
    setDeleteError(null);
    setAddError(null);
    setRemoveError(null);

    if (!effectiveToken) {
      setDeleteError("Log in to delete your list.");
      navigate("/login");
      return;
    }
    if (!isOwner) {
      setDeleteError("Only the list owner can delete this list.");
      return;
    }

    const ok = window.confirm(`Delete "${list?.title || "this list"}"? This cannot be undone.`);
    if (!ok) return;

    try {
      setDeletingList(true);

      const resp = await apiFetch(`/lists/${encodeURIComponent(listId)}`, {
        token: effectiveToken,
        method: "DELETE",
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Delete failed (${resp.status}): ${text}`);
      }

      // send them back to Collection after delete
      navigate("/collection");
    } catch (err) {
      setDeleteError(err?.message || String(err));
    } finally {
      setDeletingList(false);
    }
  }

  if (listLoading) return <div style={{ padding: "1.5rem" }}>Loading list…</div>;

  if (listError) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p style={{ color: "red" }}>Error: {listError}</p>
        <button onClick={() => navigate(-1)}>← Back</button>
      </div>
    );
  }

  if (!list) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p>List not found.</p>
        <button onClick={() => navigate(-1)}>← Back</button>
      </div>
    );
  }

  const totalCount = countForList(list);

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          marginBottom: "1rem",
          padding: "0.35rem 0.75rem",
          borderRadius: "999px",
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      <h1 style={{ margin: 0 }}>{list.title}</h1>

      <p style={{ margin: "0.35rem 0 0 0", color: "#666" }}>
        By <strong>{list.owner}</strong> ·{" "}
        <strong>{list.is_public ? "Public" : "Private"}</strong> ·{" "}
        <strong>{totalCount}</strong> set{totalCount === 1 ? "" : "s"}
      </p>

      {list.description && (
        <p style={{ marginTop: "0.75rem", color: "#444" }}>{list.description}</p>
      )}

      {/* Owner-only editor */}
      {isOwner && (
        <section
          style={{
            marginTop: "1.25rem",
            padding: "0.9rem 1rem",
            border: "1px solid #e6e6e6",
            borderRadius: "12px",
            background: "#fafafa",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Edit list</h2>

          <form
            onSubmit={handleAddItem}
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              placeholder='Add set number (e.g. "21354-1")'
              style={{
                flex: "1 1 260px",
                padding: "0.5rem 0.65rem",
                borderRadius: "10px",
                border: "1px solid #ddd",
              }}
            />
            <button
              type="submit"
              disabled={adding}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: "999px",
                border: "none",
                background: adding ? "#888" : "#111",
                color: "white",
                cursor: adding ? "default" : "pointer",
              }}
            >
              {adding ? "Adding…" : "Add"}
            </button>
          </form>

          {addError && <p style={{ color: "red", marginTop: "0.5rem" }}>{addError}</p>}

          <div style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              onClick={handleDeleteList}
              disabled={deletingList}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid #f3b4b4",
                background: "white",
                color: "#b42318",
                cursor: deletingList ? "default" : "pointer",
                fontWeight: 700,
              }}
            >
              {deletingList ? "Deleting…" : "Delete list"}
            </button>

            {deleteError && <p style={{ color: "red", marginTop: "0.5rem" }}>{deleteError}</p>}
          </div>
        </section>
      )}

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>Sets</h2>

        {setsLoading && <p>Loading sets…</p>}
        {setsError && (
          <p style={{ color: setsError.startsWith("Loaded") ? "#777" : "red" }}>
            {setsError}
          </p>
        )}

        {!setsLoading && setDetails.length === 0 && (
          <p style={{ color: "#777" }}>
            No sets in this list yet. {isOwner ? "Add one above." : ""}
          </p>
        )}

        {!setsLoading && setDetails.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
              alignItems: "start",
            }}
          >
            {setDetails.map((set) => (
              <li key={set.set_num} style={{ maxWidth: 260 }}>
                <SetCard
                  set={set}
                  isOwned={ownedSetNums ? ownedSetNums.has(set.set_num) : false}
                  isInWishlist={wishlistSetNums ? wishlistSetNums.has(set.set_num) : false}
                  onMarkOwned={onMarkOwned}
                  onAddWishlist={onAddWishlist}
                  variant="default"
                />

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(set.set_num)}
                    disabled={removing === set.set_num}
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.35rem 0.75rem",
                      borderRadius: "999px",
                      border: "1px solid #ddd",
                      background: "white",
                      color: "#b42318",
                      cursor: removing === set.set_num ? "default" : "pointer",
                      width: "100%",
                    }}
                  >
                    {removing === set.set_num ? "Removing…" : "Remove from list"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {removeError && <p style={{ color: "red", marginTop: "0.75rem" }}>{removeError}</p>}
      </section>

      <div style={{ marginTop: "2rem", color: "#777" }}>
        <Link to="/explore" style={{ color: "inherit" }}>
          Browse more public lists →
        </Link>
      </div>
    </div>
  );
}