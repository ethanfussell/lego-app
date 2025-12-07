// frontend/src/ListDetailPage.js
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const API_BASE = "http://localhost:8000";

function ListDetailPage({
  token,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const { listId } = useParams();
  const [list, setList] = useState(null);        // metadata (title, owner, etc.)
  const [sets, setSets] = useState([]);          // full set objects
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newSetNum, setNewSetNum] = useState("");
  const [addError, setAddError] = useState(null);
  const [addLoading, setAddLoading] = useState(false);

  // Load list detail (including item set_nums) and then fetch each set
  useEffect(() => {
    async function loadList() {
      try {
        setLoading(true);
        setError(null);

        const headers = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const resp = await fetch(`${API_BASE}/lists/${listId}`, { headers });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Failed to load list (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        setList(data);

        const itemSetNums = Array.isArray(data.items) ? data.items : [];

        if (itemSetNums.length === 0) {
          setSets([]);
          return;
        }

        // fetch each set detail in parallel
        const setPromises = itemSetNums.map(async (setNum) => {
          const sResp = await fetch(`${API_BASE}/sets/${encodeURIComponent(setNum)}`);
          if (!sResp.ok) {
            // if a particular set fails to load, just skip it
            return null;
          }
          return await sResp.json();
        });

        const loadedSets = (await Promise.all(setPromises)).filter(Boolean);
        setSets(loadedSets);
      } catch (err) {
        console.error("Error loading list detail:", err);
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }

    loadList();
  }, [listId, token]);

  async function handleAddSet(e) {
    e.preventDefault();
    if (!token) {
      setAddError("You must be logged in to modify this list.");
      return;
    }

    const trimmed = newSetNum.trim();
    if (!trimmed) {
      setAddError("Please enter a set number (e.g. 75395-1).");
      return;
    }

    try {
      setAddLoading(true);
      setAddError(null);

      const resp = await fetch(`${API_BASE}/lists/${listId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ set_num: trimmed }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Add failed (${resp.status}): ${text}`);
      }

      // Re-fetch the list after adding
      setNewSetNum("");
      // simplest: trigger full reload by calling the effect again:
      // (change listId dep won't help, so we just call loadList-like logic again)
      // For clarity, do a small helper:
      await reloadList();
    } catch (err) {
      console.error("Error adding set to list:", err);
      setAddError(err.message || String(err));
    } finally {
      setAddLoading(false);
    }
  }

  // helper to re-load list after adding/removing
  async function reloadList() {
    try {
      setLoading(true);
      setError(null);

      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const resp = await fetch(`${API_BASE}/lists/${listId}`, { headers });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to load list (${resp.status}): ${text}`);
      }

      const data = await resp.json();
      setList(data);

      const itemSetNums = Array.isArray(data.items) ? data.items : [];

      if (itemSetNums.length === 0) {
        setSets([]);
        return;
      }

      const setPromises = itemSetNums.map(async (setNum) => {
        const sResp = await fetch(`${API_BASE}/sets/${encodeURIComponent(setNum)}`);
        if (!sResp.ok) {
          return null;
        }
        return await sResp.json();
      });

      const loadedSets = (await Promise.all(setPromises)).filter(Boolean);
      setSets(loadedSets);
    } catch (err) {
      console.error("Error reloading list detail:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !list) {
    return <p>Loading list…</p>;
  }

  if (error && !list) {
    return <p style={{ color: "red" }}>Error: {error}</p>;
  }

  if (!list) {
    return <p>List not found.</p>;
  }

  const isOwner = !!token && list.owner; // simple check for now

  return (
    <div>
      <h1>{list.title}</h1>
      <p style={{ color: "#666" }}>
        Owner: <strong>{list.owner}</strong>{" "}
        · Visibility: <strong>{list.is_public ? "Public" : "Private"}</strong>
      </p>
      {list.description && (
        <p style={{ maxWidth: "40rem" }}>{list.description}</p>
      )}

      {/* Add-set form (owner only) */}
      {isOwner && (
        <section
          style={{
            marginTop: "1.25rem",
            marginBottom: "1.5rem",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "1rem",
            background: "#fafafa",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Add a set to this list</h3>
          <p style={{ color: "#666", marginTop: 0 }}>
            Enter a set number like <code>75395-1</code>. Later we can add a
            fancy &quot;Add to list&quot; button from search/set pages.
          </p>

          <form onSubmit={handleAddSet}>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem" }}>
                Set number
              </label>
              <input
                type="text"
                value={newSetNum}
                onChange={(e) => setNewSetNum(e.target.value)}
                placeholder="e.g. 75395-1"
                style={{
                  width: "100%",
                  maxWidth: "260px",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>

            {addError && (
              <p style={{ color: "red", marginBottom: "0.5rem" }}>{addError}</p>
            )}

            <button
              type="submit"
              disabled={addLoading}
              style={{
                padding: "0.5rem 1rem",
                cursor: addLoading ? "default" : "pointer",
              }}
            >
              {addLoading ? "Adding…" : "Add Set"}
            </button>
          </form>
        </section>
      )}

      {/* Sets in this list */}
      <section style={{ marginTop: "1rem" }}>
        <h3>Sets in this list</h3>

        {sets.length === 0 && <p>No sets in this list yet.</p>}

        {sets.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              columnGap: "1rem",
              rowGap: "1.75rem",
            }}
          >
            {sets.map((set) => {
              const setNum = set.set_num;
              const isOwned = ownedSetNums.has(setNum);
              const isInWishlist = wishlistSetNums.has(setNum);

              return (
                <li
                  key={setNum}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: "12px",
                    padding: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    background: "white",
                  }}
                >
                  <Link
                    to={`/sets/${setNum}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    {set.image_url && (
                      <div
                        style={{
                          width: "100%",
                          height: "190px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <img
                          src={set.image_url}
                          alt={set.name || setNum}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                          }}
                        />
                      </div>
                    )}

                    <h3
                      style={{
                        margin: "0 0 0.25rem 0",
                        fontSize: "1rem",
                        lineHeight: 1.3,
                      }}
                    >
                      {set.name || "Unknown set"}
                    </h3>
                    <p style={{ margin: 0, color: "#555" }}>
                      <strong>{setNum}</strong>
                      {set.year && <> · {set.year}</>}
                    </p>
                    {set.theme && (
                      <p style={{ margin: 0, color: "#777" }}>{set.theme}</p>
                    )}
                    {set.pieces && (
                      <p style={{ margin: 0, color: "#777" }}>
                        {set.pieces} pieces
                      </p>
                    )}
                  </Link>

                  <div
                    style={{
                      marginTop: "auto",
                      display: "flex",
                      gap: "0.5rem",
                      paddingTop: "0.75rem",
                    }}
                  >
                    <button
                      onClick={() => onMarkOwned(setNum)}
                      style={{
                        flex: 1,
                        padding: "0.4rem 0.6rem",
                        borderRadius: "999px",
                        border: isOwned ? "none" : "1px solid #ccc",
                        backgroundColor: isOwned ? "#1f883d" : "#f5f5f5",
                        color: isOwned ? "white" : "#333",
                        fontWeight: isOwned ? 600 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {isOwned ? "Owned ✓" : "Mark Owned"}
                    </button>

                    <button
                      onClick={() => onAddWishlist(setNum)}
                      style={{
                        flex: 1,
                        padding: "0.4rem 0.6rem",
                        borderRadius: "999px",
                        border: isInWishlist ? "none" : "1px solid #ccc",
                        backgroundColor: isInWishlist ? "#b16be3" : "#f5f5f5",
                        color: isInWishlist ? "white" : "#333",
                        fontWeight: isInWishlist ? 600 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {isInWishlist ? "In Wishlist ★" : "Add to Wishlist"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default ListDetailPage;