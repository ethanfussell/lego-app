// We import React + hooks:
// - useState → store values and trigger re-renders
// - useEffect → run side-effect code (like API calls)
// - useRef → keep a mutable value between renders (for debounce timer)
import React, { useEffect, useState, useRef } from "react";
import Login from "./Login";
import QuickCollectionsAdd from "./QuickCollectionsAdd";

// Your backend base URL
const API_BASE = "http://localhost:8000";

function App() {
  // -------------------------------
  // PUBLIC LISTS STATE
  // -------------------------------
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // -------------------------------
  // GLOBAL UI STATE
  // -------------------------------
  // Which "page" the user is on: "public", "login", or "search"
  const [page, setPage] = useState("public");

  // Auth token from login
  const [token, setToken] = useState(null);

  // -------------------------------
  // SEARCH BAR STATE (text + suggestions)
  // -------------------------------
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef(null);

  // -------------------------------
  // "MY LISTS" (AUTHED) STATE
  // -------------------------------
  const [myLists, setMyLists] = useState([]);
  const [myListsLoading, setMyListsLoading] = useState(false);
  const [myListsError, setMyListsError] = useState(null);

  // -------------------------------
  // CREATE-LIST FORM STATE
  // -------------------------------
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [newListIsPublic, setNewListIsPublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // -------------------------------
  // COLLECTIONS (Owned / Wishlist) STATE
  // -------------------------------
  const [owned, setOwned] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState(null);

  // -------------------------------
  // SEARCH STATE (results page)
  // -------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // backend supports: relevance | name | year | pieces | rating
  const [searchSort, setSearchSort] = useState("relevance");

  // Pagination state for search results
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const searchLimit = 50; // page size

  // -------------------------------
  // Helpers
  // -------------------------------

  function getPageNumbers(current, total) {
    const pages = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
      return pages;
    }

    // Near the beginning
    if (current <= 4) {
      pages.push(1, 2, 3, 4, "...", total);
      return pages;
    }

    // Near the end
    if (current >= total - 3) {
      pages.push(1, "...", total - 3, total - 2, total - 1, total);
      return pages;
    }

    // In the middle
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
    return pages;
  }

  function getOrderForSort(sortKey) {
    // rating / pieces / year: highest / newest first
    // relevance: best match first
    // name: A–Z
    if (sortKey === "rating" || sortKey === "pieces" || sortKey === "year") {
      return "desc";
    }
    return "asc";
  }

  // -------------------------------
  // SUGGESTIONS: handlers + debounced effect
  // -------------------------------

  function handleSearchChange(e) {
    const value = e.target.value;
    setSearchText(value);

    if (value.trim() === "") {
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestionsError(null);
      return;
    }

    setShowSuggestions(true);
  }

  function handleSearchBlur() {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  }

  function handleSuggestionClick(suggestion) {
    const term = suggestion.name || suggestion.set_num || "";
    setSearchText(term);
    setShowSuggestions(false);
    setPage("search");
    setSearchQuery(term);
    // Optionally you could auto-run a search here too if you want
  }

  useEffect(() => {
    const trimmed = searchText.trim();

    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestionsError(null);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        setSuggestionsError(null);

        const resp = await fetch(
          `${API_BASE}/sets/suggest?q=${encodeURIComponent(trimmed)}`
        );

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Suggest failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        setSuggestionsError(err.message || String(err));
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchText]);

  // -------------------------------
  // LOAD OWNED + WISHLIST WHEN TOKEN CHANGES
  // -------------------------------
  useEffect(() => {
    if (!token) {
      setOwned([]);
      setWishlist([]);
      return;
    }

    loadCollections(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadCollections(currentToken) {
    if (!currentToken) {
      setOwned([]);
      setWishlist([]);
      return;
    }

    try {
      setCollectionsLoading(true);
      setCollectionsError(null);

      const ownedResp = await fetch(`${API_BASE}/collections/me/owned`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (!ownedResp.ok) {
        throw new Error(
          `Failed to load owned sets (status ${ownedResp.status})`
        );
      }

      const ownedData = await ownedResp.json();
      setOwned(ownedData);

      const wishlistResp = await fetch(`${API_BASE}/collections/me/wishlist`, {
        headers: { Authorization: `Bearer ${currentToken}` },
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
  // PUBLIC LISTS: fetch on load
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

    fetchPublicLists();
  }, []);

  // -------------------------------
  // "MY LISTS": fetch when token changes
  // -------------------------------
  useEffect(() => {
    if (!token) {
      setMyLists([]);
      return;
    }

    async function fetchMyLists() {
      try {
        setMyListsLoading(true);
        setMyListsError(null);

        const resp = await fetch(`${API_BASE}/lists/me`, {
          headers: { Authorization: `Bearer ${token}` },
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


  useEffect(() => {
    // Only enable keyboard page navigation on the search page
    if (page !== "search" || searchResults.length === 0) {
      return;
    }
  
    function handleKeyDown(e) {
      // Don't hijack keys if user is typing in an input/textarea
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") {
        return;
      }
  
      if (e.key === "ArrowRight") {
        const totalPages =
          searchTotal > 0
            ? Math.ceil(searchTotal / searchLimit)
            : 1;
  
        if (!searchLoading && searchPage < totalPages) {
          e.preventDefault();
          runSearch(searchQuery, searchSort, searchPage + 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (!searchLoading && searchPage > 1) {
          e.preventDefault();
          runSearch(searchQuery, searchSort, searchPage - 1);
        }
      }
    }
  
    window.addEventListener("keydown", handleKeyDown);
  
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    page,
    searchResults.length,
    searchTotal,
    searchLimit,
    searchLoading,
    searchPage,
    searchQuery,
    searchSort,
  ]); // 👈 deps

  // -------------------------------
  // CREATE NEW LIST
  // -------------------------------
  async function handleCreateList(event) {
    event.preventDefault();

    if (!token) {
      setCreateError("You must be logged in to create a list.");
      return;
    }

    if (!newListTitle.trim()) {
      setCreateError("Title is required.");
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError(null);

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

      const created = await resp.json();

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

      setMyLists((prev) => [summary, ...prev]);

      setNewListTitle("");
      setNewListDescription("");
      setNewListIsPublic(true);
      setShowCreateForm(false);
    } catch (err) {
      console.error("Error creating list:", err);
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  }

  // -------------------------------
  // COLLECTION MUTATIONS (owned / wishlist)
  // -------------------------------
  async function handleMarkOwned(setNum) {
    if (!token) {
      alert("Please log in to track your collection.");
      setPage("login");
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/collections/owned`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ set_num: setNum }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to mark owned (${resp.status}): ${text}`);
      }

      await loadCollections(token);
    } catch (err) {
      console.error("Error marking owned:", err);
      alert(err.message);
    }
  }

  async function handleAddWishlist(setNum) {
    if (!token) {
      alert("Please log in to track your collection.");
      setPage("login");
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/collections/wishlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ set_num: setNum }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to add to wishlist (${resp.status}): ${text}`);
      }

      await loadCollections(token);
    } catch (err) {
      console.error("Error adding to wishlist:", err);
      alert(err.message);
    }
  }

  // -------------------------------
  // SEARCH: core function + handlers
  // -------------------------------
  async function runSearch(query, sortKey = searchSort, pageNum = 1) {
    const trimmed = (query || "").trim();
    if (!trimmed) return;

    setPage("search");
    setSearchQuery(trimmed);
    setSearchPage(pageNum);
    
    // Smooth scroll to top whenever we (re)run a search
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    try {
      setSearchLoading(true);
      setSearchError(null);
      setSearchResults([]);

      const params = new URLSearchParams();
      params.set("q", trimmed);
      params.set("sort", sortKey);
      params.set("order", getOrderForSort(sortKey));
      params.set("page", String(pageNum));
      params.set("limit", String(searchLimit));

      const resp = await fetch(`${API_BASE}/sets?${params.toString()}`);

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Search failed (${resp.status}): ${text}`);
      }

      const data = await resp.json();
      const items = Array.isArray(data) ? data : data.results || [];
      setSearchResults(items);

      const totalStr = resp.headers.get("X-Total-Count");
      if (totalStr) {
        const totalNum = parseInt(totalStr, 10);
        if (!Number.isNaN(totalNum)) {
          setSearchTotal(totalNum);
        } else {
          setSearchTotal(items.length);
        }
      } else {
        setSearchTotal(items.length);
      }
    } catch (err) {
      console.error("Error searching sets:", err);
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSearchSubmit(event) {
    event.preventDefault();
    setShowSuggestions(false);
    await runSearch(searchText, searchSort, 1);
  }

  async function handleSearchSortChange(e) {
    const newSort = e.target.value;
    setSearchSort(newSort);

    if (!searchQuery.trim()) return;

    await runSearch(searchQuery, newSort, 1);
  }

  async function handleSearchNextPage() {
    const totalPages =
      searchTotal > 0 ? Math.ceil(searchTotal / searchLimit) : 1;

    if (searchPage >= totalPages) return;
    await runSearch(searchQuery, searchSort, searchPage + 1);
  }

  async function handleSearchPrevPage() {
    if (searchPage <= 1) return;
    await runSearch(searchQuery, searchSort, searchPage - 1);
  }

  // -------------------------------
  // LOGOUT
  // -------------------------------
  function handleLogout() {
    setToken(null);
    setMyLists([]);
    setOwned([]);
    setWishlist([]);
  }

  // -------------------------------
  // Pagination derived values
  // -------------------------------
  const totalPages =
    searchTotal > 0 ? Math.max(1, Math.ceil(searchTotal / searchLimit)) : 1;
  const pageNumbers = getPageNumbers(searchPage, totalPages);

  // -------------------------------
  // RENDER
  // -------------------------------
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* ========================== TOP NAV ========================== */}
      <nav
        style={{
          display: "flex",
          gap: "1rem",
          padding: "1rem",
          borderBottom: "1px solid #ddd",
          marginBottom: "1.5rem",
          alignItems: "center",
        }}
      >
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

        {/* Search bar */}
        <form
          onSubmit={handleSearchSubmit}
          style={{ position: "relative", marginLeft: "1rem" }}
        >
          <input
            type="text"
            placeholder="Search sets..."
            value={searchText}
            onChange={handleSearchChange}
            onBlur={handleSearchBlur}
            style={{
              padding: "0.5rem",
              borderRadius: "6px",
              border: "1px solid #ccc",
              width: "220px",
            }}
          />

          {showSuggestions && suggestions.length > 0 && (
            <ul
              style={{
                position: "absolute",
                top: "110%",
                left: 0,
                right: 0,
                background: "white",
                border: "1px solid #ddd",
                borderRadius: "6px",
                listStyle: "none",
                margin: 0,
                padding: "0.25rem 0",
                zIndex: 20,
                maxHeight: "240px",
                overflowY: "auto",
              }}
            >
              {suggestions.map((s) => (
                <li
                  key={s.set_num}
                  onMouseDown={() => handleSuggestionClick(s)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <strong>{s.name}</strong>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>
                    {s.set_num} • {s.year}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </form>

        {token && (
          <button
            onClick={handleLogout}
            style={{
              padding: "0.5rem 1rem",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            Log out
          </button>
        )}
      </nav>

      {/* ========================== MAIN CONTENT ========================== */}
      <div style={{ padding: "1.5rem" }}>
        {/* -------- PUBLIC PAGE -------- */}
        {page === "public" && (
          <>
            <h1>LEGO Lists App</h1>
            <p style={{ color: "#666" }}>
              This page is pulling data directly from your FastAPI backend
              (GET <code>/lists/public</code>).
            </p>

            {loading && <p>Loading public lists…</p>}
            {error && <p style={{ color: "red" }}>Error: {error}</p>}

            {!loading && !error && lists.length === 0 && (
              <p>No public lists yet. Create one in the backend.</p>
            )}

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

        {/* -------- SEARCH RESULTS PAGE -------- */}
        {page === "search" && (
          <div>
            <h1>Search Results</h1>

            {/* Top row: "showing results" + sort dropdown */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                margin: "0.5rem 0 1rem 0",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              {/* LEFT SIDE: query + showing X–Y of Z */}
              <div>
                <p style={{ color: "#666", margin: 0 }}>
                  Showing results for: <strong>{searchQuery}</strong>
                </p>

                <p
                  style={{
                    margin: "0.25rem 0 0 0",
                    fontSize: "0.9rem",
                    color: "#666",
                  }}
                >
                  Showing{" "}
                  <strong>{(searchPage - 1) * searchLimit + 1}</strong> –{" "}
                  <strong>{Math.min(searchPage * searchLimit, searchTotal)}</strong>{" "}
                  of <strong>{searchTotal}</strong> results
                </p>
              </div>

              {/* RIGHT SIDE: sort dropdown */}
              <div>
                <label>
                  Sort by{" "}
                  <select
                    value={searchSort}
                    onChange={handleSearchSortChange}
                    style={{ padding: "0.25rem 0.5rem" }}
                  >
                    <option value="relevance">Best match</option>
                    <option value="rating">Rating</option>
                    <option value="year">Year</option>
                    <option value="pieces">Pieces</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                </label>
              </div>
            </div>

            {searchLoading && <p>Searching…</p>}
            {searchError && (
              <p style={{ color: "red" }}>Error: {searchError}</p>
            )}

            {!searchLoading && !searchError && searchResults.length === 0 && (
              <p>No sets found.</p>
            )}

            {!searchLoading && !searchError && searchResults.length > 0 && (
              <div>
                {/* Results grid */}
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {searchResults.map((set) => (
                    <li
                      key={set.set_num}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        padding: "0.75rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      {/* Image thumbnail, if provided by backend */}
                      {set.image_url && (
                        <img
                          src={set.image_url}
                          alt={set.name || set.set_num}
                          style={{
                            width: "100%",
                            height: "180px",
                            objectFit: "cover",
                            borderRadius: "4px",
                          }}
                        />
                      )}

                      <div>
                        <h3 style={{ margin: "0 0 0.25rem 0" }}>
                          {set.name || "Unknown set"}
                        </h3>
                        <p style={{ margin: 0, color: "#555" }}>
                          <strong>{set.set_num}</strong>
                          {set.year && <> · {set.year}</>}
                        </p>
                        {set.theme && (
                          <p style={{ margin: 0, color: "#777" }}>
                            {set.theme}
                          </p>
                        )}
                        {set.pieces && (
                          <p style={{ margin: 0, color: "#777" }}>
                            {set.pieces} pieces
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {/* ---------- BOTTOM PAGINATION CONTROLS ---------- */}
                <div
                  style={{
                    marginTop: "1.25rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid #eee",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    fontSize: "0.9rem",
                    alignItems: "center",
                  }}
                >
                  {/* Prev / Numbers / Next */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Previous */}
                    <button
                      onClick={handleSearchPrevPage}
                      disabled={searchPage <= 1 || searchLoading}
                      style={{
                        padding: "0.35rem 0.9rem",
                        borderRadius: "999px",
                        border: "1px solid #d1d5db",
                        backgroundColor:
                          searchPage <= 1 || searchLoading
                            ? "#f3f4f6"
                            : "white",
                        color:
                          searchPage <= 1 || searchLoading
                            ? "#9ca3af"
                            : "#111827",
                        cursor:
                          searchPage <= 1 || searchLoading
                            ? "default"
                            : "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      ← Prev
                    </button>

                    {/* Numbered Pages */}
                    {pageNumbers.map((p, idx) =>
                      p === "..." ? (
                        <span key={idx} style={{ padding: "0 0.25rem" }}>
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => runSearch(searchQuery, searchSort, p)}
                          disabled={searchPage === p || searchLoading}
                          style={{
                            padding: "0.35rem 0.9rem",
                            borderRadius: "999px",
                            border:
                              searchPage === p
                                ? "1px solid #111827"
                                : "1px solid #d1d5db",
                            backgroundColor:
                              searchPage === p ? "#111827" : "white",
                            color: searchPage === p ? "white" : "#111827",
                            fontWeight: searchPage === p ? "600" : "400",
                            cursor:
                              searchPage === p || searchLoading
                                ? "default"
                                : "pointer",
                            fontSize: "0.85rem",
                          }}
                        >
                          {p}
                        </button>
                      )
                    )}

                    {/* Next */}
                    <button
                      onClick={handleSearchNextPage}
                      disabled={searchPage >= totalPages || searchLoading}
                      style={{
                        padding: "0.35rem 0.9rem",
                        borderRadius: "999px",
                        border: "1px solid #d1d5db",
                        backgroundColor:
                          searchPage >= totalPages || searchLoading
                            ? "#f3f4f6"
                            : "white",
                        color:
                          searchPage >= totalPages || searchLoading
                            ? "#9ca3af"
                            : "#111827",
                        cursor:
                          searchPage >= totalPages || searchLoading
                            ? "default"
                            : "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------- LOGIN / MY ACCOUNT PAGE -------- */}
        {page === "login" && (
          <div>
            <h1>Account</h1>

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

            {token && (
              <div style={{ marginTop: "1.5rem" }}>
                <QuickCollectionsAdd
                  token={token}
                  onCollectionsChanged={() => loadCollections(token)}
                />

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
                            border: "1px solid #ccc",
                            minHeight: "60px",
                          }}
                          placeholder="Describe this list..."
                        />
                      </div>

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

                <section
                  style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}
                >
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
                          <ul
                            style={{
                              listStyle: "none",
                              padding: 0,
                              marginTop: "0.5rem",
                            }}
                          >
                            {owned.map((item) => (
                              <li key={item.set_num}>
                                {item.set_num}{" "}
                                <span style={{ color: "#888" }}>
                                  ({item.type})
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

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
                          Sets in Wishlist:{" "}
                          <strong>{wishlist.length}</strong>
                        </p>

                        {wishlist.length === 0 && (
                          <p style={{ color: "#666" }}>
                            You haven&apos;t added any sets to your Wishlist
                            yet.
                          </p>
                        )}

                        {wishlist.length > 0 && (
                          <ul
                            style={{
                              listStyle: "none",
                              padding: 0,
                              marginTop: "0.5rem",
                            }}
                          >
                            {wishlist.map((item) => (
                              <li key={item.set_num}>
                                {item.set_num}{" "}
                                <span style={{ color: "#888" }}>
                                  ({item.type})
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </section>

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