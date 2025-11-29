// We import React + two hooks:
// - useState → store values and trigger re-renders
// - useEffect → run side-effect code (like API calls) at certain times
import React, { useEffect, useState } from "react";
import Login from "./Login"; // our login form component
import QuickCollectionsAdd from "./QuickCollectionsAdd";

// Your backend base URL
const API_BASE = "http://localhost:8000";

function App() {
  // -------------------------------
  // PUBLIC LISTS STATE
  // -------------------------------

  // Public lists (GET /lists/public)
  const [lists, setLists] = useState([]);

  // Loading + error for the PUBLIC lists
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // -------------------------------
  // GLOBAL UI STATE
  // -------------------------------

  // Which "page" the user is on: "public" or "login"
  const [page, setPage] = useState("public");

  // 🔐 Token we get after logging in successfully
  const [token, setToken] = useState(null);

  // -------------------------------
  // "MY LISTS" (AUTHED) STATE
  // -------------------------------

  // Lists from GET /lists/me (requires token)
  const [myLists, setMyLists] = useState([]);
  const [myListsLoading, setMyListsLoading] = useState(false);
  const [myListsError, setMyListsError] = useState(null);

  // -------------------------------
  // CREATE-LIST FORM STATE
  // -------------------------------

  // Controlled inputs for the "Create New List" form
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [newListIsPublic, setNewListIsPublic] = useState(true);

  // Loading + error for just the "create list" action
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Whether to show/hide the Create List form on the My Lists page
  const [showCreateForm, setShowCreateForm] = useState(false);

  // ----- COLLECTIONS (Owned / Wishlist) STATE -----
  const [owned, setOwned] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState(null);

  // Load Owned + Wishlist whenever token changes
  useEffect(() => {
    if (!token) {
      // if logged out, clear collections
      setOwned([]);
      setWishlist([]);
      return;
    }

  // if logged in, load from backend
  loadCollections(token);
}, [token]); // re-run whenever token changes

  // Helper: load Owned + Wishlist for the current user
async function loadCollections(currentToken) {
  if (!currentToken) {
    setOwned([]);
    setWishlist([]);
    return;
  }

  try {
    setCollectionsLoading(true);
    setCollectionsError(null);

    // 1) GET /collections/me/owned
    const ownedResp = await fetch(`${API_BASE}/collections/me/owned`, {
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!ownedResp.ok) {
      throw new Error(
        `Failed to load owned sets (status ${ownedResp.status})`
      );
    }

    const ownedData = await ownedResp.json();
    setOwned(ownedData);

    // 2) GET /collections/me/wishlist
    const wishlistResp = await fetch(`${API_BASE}/collections/me/wishlist`, {
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!wishlistResp.ok) {
      throw new Error(
        `Failed to load wishlist sets (status ${wishlistResp.status})`
      );
    }

    const wishlistData = await wishlistResp.json();
    setWishlist(wishlistData);
  } catch (err) {
    console.error("Error loading collections:", err);
    setCollectionsError(err.message);
  } finally {
    setCollectionsLoading(false);
  }
}

  // -------------------------------
  // 1) FETCH PUBLIC LISTS ON PAGE LOAD
  // -------------------------------
  useEffect(() => {
    async function fetchPublicLists() {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch(`${API_BASE}/lists/public`);

        if (!resp.ok) {
          throw new Error(`Request failed with status ${resp.status}`);
        }

        const data = await resp.json();
        setLists(data);
      } catch (err) {
        console.error("Error fetching public lists:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    // Run once on first render
    fetchPublicLists();
  }, []);

  // -------------------------------
  // 2) FETCH "MY LISTS" WHEN WE HAVE A TOKEN
  // -------------------------------
  useEffect(() => {
    // If user is NOT logged in, clear my lists and bail out
    if (!token) {
      setMyLists([]);
      return;
    }

    async function fetchMyLists() {
      try {
        setMyListsLoading(true);
        setMyListsError(null);

        // Call the protected endpoint with the Bearer token
        const resp = await fetch(`${API_BASE}/lists/me`, {
          headers: {
            Authorization: `Bearer ${token}`, // 🔑 send the token here
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to load your lists (status ${resp.status})`);
        }

        const data = await resp.json();
        setMyLists(data);
      } catch (err) {
        console.error("Error fetching my lists:", err);
        setMyListsError(err.message);
      } finally {
        setMyListsLoading(false);
      }
    }

    fetchMyLists();
  }, [token]);

  // -------------------------------
  // 3) CREATE NEW LIST HANDLER (FORM)
  // -------------------------------
  async function handleCreateList(event) {
    // Prevent the browser from doing a full page reload on form submit
    event.preventDefault();

    // If somehow we got here without a token, just bail
    if (!token) {
      setCreateError("You must be logged in to create a list.");
      return;
    }

    // Basic validation: title is required
    if (!newListTitle.trim()) {
      setCreateError("Title is required.");
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError(null);

      // Build the payload expected by your FastAPI ListCreate schema
      const payload = {
        title: newListTitle.trim(),
        description: newListDescription.trim() || null,
        is_public: newListIsPublic,
      };

      const resp = await fetch(`${API_BASE}/lists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Create failed (${resp.status}): ${text}`);
      }

      // This should be the full created list (UserList)
      const created = await resp.json();

      // Convert created list into the same "shape" as items from /lists/me
      const summary = {
        id: created.id,
        title: created.title,
        owner: created.owner,
        is_public: created.is_public,
        items_count: Array.isArray(created.items) ? created.items.length : 0,
        description: created.description,
        created_at: created.created_at,
        updated_at: created.updated_at,
      };

      // Put the new list at the top of "My Lists"
      setMyLists((prev) => [summary, ...prev]);

      // Clear form fields
      setNewListTitle("");
      setNewListDescription("");
      setNewListIsPublic(true);
      setShowCreateForm(false); // hide form after successful create
    } catch (err) {
      console.error("Error creating list:", err);
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  }

  // Simple logout function
  function handleLogout() {
    setToken(null);
    setMyLists([]);
  }

  // -------------------------------
  // WHAT THE USER ACTUALLY SEES
  // -------------------------------
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* ==========================
          TOP NAVIGATION BAR
         ========================== */}
    <nav
      style={{
        display: "flex",
        gap: "1rem",
        padding: "1rem",
        borderBottom: "1px solid #ddd",
        marginBottom: "1.5rem",
      }}
    >
      {/* PUBLIC LISTS tab */}
      <button
        onClick={() => setPage("public")}
        style={{
          padding: "0.5rem 1rem",
          cursor: "pointer",
          fontWeight: page === "public" ? "bold" : "normal",
        }}
      >
        🌍 Public Lists
      </button>

      {/* LOGIN / ACCOUNT tab */}
      <button
        onClick={() => setPage("login")}
        style={{
          padding: "0.5rem 1rem",
          cursor: "pointer",
          fontWeight: page === "login" ? "bold" : "normal",
        }}
      >
        🔐 Login / My Lists
      </button>

      {/* LOGOUT on the right, only when logged in */}
      {token && (
        <button
          onClick={handleLogout}
          style={{
            padding: "0.5rem 1rem",
            cursor: "pointer",
            marginLeft: "auto", // pushes this button to the far right
          }}
        >
          Log out
        </button>
      )}
    </nav>

      {/* ==========================
          MAIN PAGE CONTENT
         ========================== */}
      <div style={{ padding: "1.5rem" }}>
        {/* -------- PUBLIC PAGE -------- */}
        {page === "public" && (
          <>
            <h1>LEGO Lists App</h1>
            <p style={{ color: "#666" }}>
              This page is pulling data directly from your FastAPI backend
              (GET <code>/lists/public</code>).
            </p>

            {/* Show loading message */}
            {loading && <p>Loading public lists…</p>}

            {/* Show error message */}
            {error && <p style={{ color: "red" }}>Error: {error}</p>}

            {/* If everything worked AND there are no lists */}
            {!loading && !error && lists.length === 0 && (
              <p>No public lists yet. Create one in the backend.</p>
            )}

            {/* If everything worked AND we have lists */}
            {!loading && !error && lists.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {lists.map((list) => (
                  <li
                    key={list.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      padding: "1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <h2>{list.title}</h2>

                    <p>
                      Owner: <strong>{list.owner}</strong>
                    </p>

                    <p>
                      Sets in list: <strong>{list.items_count}</strong>
                    </p>

                    <p>
                      Visibility:{" "}
                      <strong>{list.is_public ? "Public" : "Private"}</strong>
                    </p>

                    {list.description && <p>{list.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* -------- LOGIN / MY ACCOUNT PAGE -------- */}
        {page === "login" && (
          <div>
            <h1>Account</h1>

            {/* If we DON'T have a token yet, show the Login form */}
            {!token && (
              <>
                <p style={{ color: "#666" }}>
                  Log in with your fake user (ethan / lego123).
                </p>
                <Login
                  onLoginSuccess={(accessToken) => {
                    setToken(accessToken);
                    console.log("Logged in! Token:", accessToken);
                  }}
                />
              </>
            )}

            {/* If we DO have a token, show account UI */}
            {token && (
              <div style={{ marginTop: "1.5rem" }}>
                {/* 👇 Quick add box, only useful once logged in */}
                <QuickCollectionsAdd
                  token={token}
                  onCollectionsChanged={() => loadCollections(token)}
                />

                {/* Header row: title + buttons */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                    gap: "1rem",
                  }}
                >
                  <h2 style={{ margin: 0 }}>My Lists</h2>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {/* Button to show/hide create form */}
                    <button
                      onClick={() => setShowCreateForm((prev) => !prev)}
                      style={{
                        padding: "0.4rem 0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      {showCreateForm ? "Cancel" : "➕ Create New List"}
                    </button>
                  </div>
                </div>

                {/* ---------- CREATE NEW LIST FORM (TOGGLED BY BUTTON) ---------- */}
                {showCreateForm && (
                  <section
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      padding: "1rem",
                      marginBottom: "1.5rem",
                      background: "#fafafa",
                    }}
                  >
                    <h3>Create a New List</h3>
                    <p style={{ color: "#666", marginTop: 0 }}>
                      This will call <code>POST /lists</code> with your token.
                    </p>

                    <form onSubmit={handleCreateList}>
                      {/* Title input */}
                      <div style={{ marginBottom: "0.75rem" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Title (required)
                        </label>
                        <input
                          type="text"
                          value={newListTitle}
                          onChange={(e) => setNewListTitle(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                          }}
                          placeholder="e.g. Favorite Castle Sets"
                        />
                      </div>

                      {/* Description input */}
                      <div style={{ marginBottom: "0.75rem" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Description (optional)
                        </label>
                        <textarea
                          value={newListDescription}
                          onChange={(e) =>
                            setNewListDescription(e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid " +
                              "#ccc",
                            minHeight: "60px",
                          }}
                          placeholder="Describe this list..."
                        />
                      </div>

                      {/* Public / Private toggle */}
                      <div style={{ marginBottom: "0.75rem" }}>
                        <label>
                          <input
                            type="checkbox"
                            checked={newListIsPublic}
                            onChange={(e) =>
                              setNewListIsPublic(e.target.checked)
                            }
                            style={{ marginRight: "0.5rem" }}
                          />
                          Public list?
                        </label>
                      </div>

                      {/* Error + button */}
                      {createError && (
                        <p style={{ color: "red", marginBottom: "0.5rem" }}>
                          {createError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={createLoading}
                        style={{
                          padding: "0.5rem 1rem",
                          cursor: createLoading ? "default" : "pointer",
                        }}
                      >
                        {createLoading ? "Creating..." : "Create List"}
                      </button>
                    </form>
                  </section>
                )}
                {/* ---------- MY COLLECTIONS (OWNED + WISHLIST) ---------- */}
                  <section style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
                    <h2>My Collections</h2>

                    {collectionsLoading && <p>Loading your collections…</p>}
                    {collectionsError && (
                      <p style={{ color: "red" }}>Error: {collectionsError}</p>
                    )}

                    {!collectionsLoading && !collectionsError && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "1rem",
                          marginTop: "0.5rem",
                        }}
                      >
                        {/* Owned */}
                        <div
                          style={{
                            flex: "1 1 240px",
                            border: "1px solid #ddd",
                            borderRadius: "8px",
                            padding: "1rem",
                          }}
                        >
                          <h3>Owned</h3>
                          <p>
                            Sets in Owned: <strong>{owned.length}</strong>
                          </p>

                          {owned.length === 0 && (
                            <p style={{ color: "#666" }}>
                              You haven&apos;t marked any sets as Owned yet.
                            </p>
                          )}

                          {owned.length > 0 && (
                            <ul style={{ listStyle: "none", padding: 0, marginTop: "0.5rem" }}>
                              {owned.map((item) => (
                                <li key={item.set_num}>
                                  {item.set_num}{" "}
                                  <span style={{ color: "#888" }}>
                                    ({item.type}){/* will be "owned" */}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Wishlist */}
                        <div
                          style={{
                            flex: "1 1 240px",
                            border: "1px solid #ddd",
                            borderRadius: "8px",
                            padding: "1rem",
                          }}
                        >
                          <h3>Wishlist</h3>
                          <p>
                            Sets in Wishlist: <strong>{wishlist.length}</strong>
                          </p>

                          {wishlist.length === 0 && (
                            <p style={{ color: "#666" }}>
                              You haven&apos;t added any sets to your Wishlist yet.
                            </p>
                          )}

                          {wishlist.length > 0 && (
                            <ul style={{ listStyle: "none", padding: 0, marginTop: "0.5rem" }}>
                              {wishlist.map((item) => (
                                <li key={item.set_num}>
                                  {item.set_num}{" "}
                                  <span style={{ color: "#888" }}>
                                    ({item.type}){/* will be "wishlist" */}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </section>

                {/* ---------- MY LISTS DISPLAY ---------- */}
                {myListsLoading && <p>Loading your lists…</p>}

                {myListsError && (
                  <p style={{ color: "red" }}>Error: {myListsError}</p>
                )}

                {!myListsLoading && !myListsError && myLists.length === 0 && (
                  <p>You don&apos;t have any lists yet.</p>
                )}

                {!myListsLoading && !myListsError && myLists.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    {myLists.map((list) => (
                      <li
                        key={list.id}
                        style={{
                          border: "1px solid #ddd",
                          borderRadius: "8px",
                          padding: "1rem",
                          marginBottom: "1rem",
                        }}
                      >
                        <h3>{list.title}</h3>
                        {list.description && <p>{list.description}</p>}
                        <p>
                          Sets in list: <strong>{list.items_count}</strong>
                        </p>
                        <p>
                          Visibility:{" "}
                          <strong>
                            {list.is_public ? "Public" : "Private"}
                          </strong>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Little status message under everything */}
                {!myListsLoading && !myListsError && (
                  <p style={{ marginTop: "0.5rem", color: "green" }}>
                    Logged in: token stored in React state and used for
                    <code> /lists/me</code> and <code> /lists</code>.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;