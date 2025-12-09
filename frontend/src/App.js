// src/App.js
// Main React app for LEGO tracker

import React, { useEffect, useState, useRef } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";

import Login from "./Login";
import Pagination from "./Pagination";
import SetDetailPage from "./SetDetailPage";
import SetCard from "./SetCard";
import ListDetailPage from "./ListDetailPage";

const API_BASE = "http://localhost:8000";

/* -------------------------------------------------------
   Reusable horizontal row of SetCards
-------------------------------------------------------- */
function SetRow({
  title,
  sets,
  ownedSetNums = new Set(),
  wishlistSetNums = new Set(),
  onMarkOwned,
  onAddWishlist,
  variant = "default",
}) {
  if (!sets || sets.length === 0) return null;

  return (
    <section style={{ marginBottom: "1.75rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.5rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
      </div>

      <div
        style={{
          overflowX: "auto",
          paddingBottom: "0.5rem",
        }}
      >
        <ul
          style={{
            display: "flex",
            gap: "0.75rem",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {sets.map((set) => (
            <li
              key={set.set_num}
              style={{ minWidth: "220px", maxWidth: "220px", flex: "0 0 auto" }}
            >
              <SetCard
                set={set}
                isOwned={ownedSetNums.has(set.set_num)}
                isInWishlist={wishlistSetNums.has(set.set_num)}
                onMarkOwned={onMarkOwned}
                onAddWishlist={onAddWishlist}
                variant={variant}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------
   Home page: hero + 4 sections
-------------------------------------------------------- */
function HomePage({
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const [featuredSets, setFeaturedSets] = useState([]);
  const [dealsSets, setDealsSets] = useState([]);
  const [retiringSets, setRetiringSets] = useState([]);
  const [trendingSets, setTrendingSets] = useState([]);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeError, setHomeError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHomeSets() {
      try {
        setHomeLoading(true);
        setHomeError(null);

        const params = new URLSearchParams();
        params.set("q", "lego"); // generic search term
        params.set("sort", "rating");
        params.set("order", "desc");
        params.set("page", "1");
        params.set("limit", "40");

        const resp = await fetch(`${API_BASE}/sets?${params.toString()}`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Home feed failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        const items = Array.isArray(data) ? data : data.results || [];

        if (cancelled) return;

        setFeaturedSets(items.slice(0, 8));
        setDealsSets(items.slice(8, 16));
        setRetiringSets(items.slice(16, 24));
        setTrendingSets(items.slice(24, 32));
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading home sets:", err);
          setHomeError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setHomeLoading(false);
        }
      }
    }

    fetchHomeSets();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Hero / intro */}
      <section style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Track your LEGO world</h1>
        <p style={{ marginTop: "0.5rem", color: "#666", maxWidth: "560px" }}>
          Log your collection, wishlist, and reviews. Discover deals, sets
          retiring soon, and what&apos;s trending with other fans.
        </p>
      </section>

      {homeLoading && <p>Loading sets…</p>}
      {homeError && (
        <p style={{ color: "red" }}>Error loading homepage: {homeError}</p>
      )}

      {/* Rows – they hide themselves if their set list is empty */}
      <SetRow
        title="Featured Sets"
        sets={featuredSets}
        ownedSetNums={ownedSetNums}
        wishlistSetNums={wishlistSetNums}
        onMarkOwned={onMarkOwned}
        onAddWishlist={onAddWishlist}
        variant="home"
      />

      <SetRow
        title="Deals & Price Drops"
        sets={dealsSets}
        ownedSetNums={ownedSetNums}
        wishlistSetNums={wishlistSetNums}
        onMarkOwned={onMarkOwned}
        onAddWishlist={onAddWishlist}
        variant="home"
      />

      <SetRow
        title="Retiring Soon"
        sets={retiringSets}
        ownedSetNums={ownedSetNums}
        wishlistSetNums={wishlistSetNums}
        onMarkOwned={onMarkOwned}
        onAddWishlist={onAddWishlist}
        variant="home"
      />

      <SetRow
        title="Trending Right Now"
        sets={trendingSets}
        ownedSetNums={ownedSetNums}
        wishlistSetNums={wishlistSetNums}
        onMarkOwned={onMarkOwned}
        onAddWishlist={onAddWishlist}
        variant="home"
      />
    </div>
  );
}


// ===================== COLLECTION PAGE =====================
function CollectionPage({
  owned,
  wishlist,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const [activeTab, setActiveTab] = React.useState("owned");
  const [tabSets, setTabSets] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      const source = activeTab === "owned" ? owned : wishlist;

      if (!source || source.length === 0) {
        setTabSets([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // unique set_nums from the collection
        const uniqueSetNums = Array.from(
          new Set(source.map((item) => item.set_num))
        );

        const results = await Promise.all(
          uniqueSetNums.map(async (num) => {
            try {
              const resp = await fetch(
                `${API_BASE}/sets/${encodeURIComponent(num)}`
              );
              if (!resp.ok) {
                throw new Error(
                  `Failed to load set ${num} (status ${resp.status})`
                );
              }
              return await resp.json();
            } catch (err) {
              console.error("Error loading set in collection:", num, err);
              return null; // skip this one
            }
          })
        );

        if (!cancelled) {
          setTabSets(results.filter(Boolean));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [activeTab, owned, wishlist]);

  const totalOwned = owned ? owned.length : 0;
  const totalWishlist = wishlist ? wishlist.length : 0;

  return (
    <div>
      <h1>Collection</h1>
      <p style={{ color: "#666", marginBottom: "1rem" }}>
        View sets you&apos;ve marked as Owned or added to your Wishlist.
      </p>

      {/* Tabs */}
      <div
        style={{
          display: "inline-flex",
          borderRadius: "999px",
          border: "1px solid #ddd",
          padding: "0.15rem",
          marginBottom: "1rem",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("owned")}
          style={{
            padding: "0.35rem 0.9rem",
            borderRadius: "999px",
            border: "none",
            backgroundColor: activeTab === "owned" ? "#111827" : "transparent",
            color: activeTab === "owned" ? "white" : "#111827",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Owned ({totalOwned})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("wishlist")}
          style={{
            padding: "0.35rem 0.9rem",
            borderRadius: "999px",
            border: "none",
            backgroundColor:
              activeTab === "wishlist" ? "#111827" : "transparent",
            color: activeTab === "wishlist" ? "white" : "#111827",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Wishlist ({totalWishlist})
        </button>
      </div>

      {loading && <p>Loading sets…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && tabSets.length === 0 && (
        <p style={{ color: "#666" }}>
          {activeTab === "owned"
            ? "You haven\u2019t marked any sets as Owned yet. Use the “Mark Owned” button on a set page to add it here."
            : "You haven\u2019t added any sets to your Wishlist yet. Use the “Add to Wishlist” button on a set page to add it here."}
        </p>
      )}

      {!loading && !error && tabSets.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: "1.5rem",
          }}
        >
          {tabSets.map((set) => (
            <li
              key={set.set_num}
              style={{
                flex: "0 0 240px",  // fixed card width
                maxWidth: "240px",
              }}
            >
              <SetCard
                set={set}
                isOwned={ownedSetNums ? ownedSetNums.has(set.set_num) : false}
                isInWishlist={
                  wishlistSetNums ? wishlistSetNums.has(set.set_num) : false
                }
                onMarkOwned={onMarkOwned}
                onAddWishlist={onAddWishlist}
                variant="collection"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   Main App
-------------------------------------------------------- */
function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // -------------------------------
  // Public lists (Explore page)
  // -------------------------------
  const [lists, setLists] = useState([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState(null);

  // -------------------------------
  // Global UI state
  // -------------------------------
  const [page, setPage] = useState("home"); // "home", "search", "login", etc.

  // Auth token
  const [token, setToken] = useState(() => {
    return localStorage.getItem("lego_token") || "";
  });

  // -------------------------------
  // Search bar + suggestions
  // -------------------------------
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef(null);

  // -------------------------------
  // My Lists (authed)
  // -------------------------------
  const [myLists, setMyLists] = useState([]);
  const [myListsLoading, setMyListsLoading] = useState(false);
  const [myListsError, setMyListsError] = useState(null);

  // -------------------------------
  // Create-list form
  // -------------------------------
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [newListIsPublic, setNewListIsPublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // -------------------------------
  // Collections (Owned / Wishlist)
  // -------------------------------
  const [owned, setOwned] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState(null);

  // -------------------------------
  // Search results state
  // -------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchSort, setSearchSort] = useState("relevance");
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const searchLimit = 50;

  // Persist token in localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem("lego_token", token);
    } else {
      localStorage.removeItem("lego_token");
    }
  }, [token]);

  /* -------------------------------
     Helpers
  --------------------------------*/
  function getOrderForSort(sortKey) {
    if (sortKey === "rating" || sortKey === "pieces" || sortKey === "year") {
      return "desc";
    }
    return "asc";
  }

  /* -------------------------------
     Search suggestions
  --------------------------------*/
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

  function handleSearchAllClick() {
    const trimmed = searchText.trim();
    if (!trimmed) return;
  
    setShowSuggestions(false);
    setSuggestions([]);
    setPage("search");
    navigate("/search");
  
    // run a normal search
    runSearch(trimmed, searchSort, 1);
  }

  function handleSearchBlur() {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  }

  function handleSuggestionClick(suggestion) {
    const term = suggestion.name || suggestion.set_num || "";
  
    // put the text in the box just for visual feedback
    setSearchText(term);
  
    // hide suggestions
    setShowSuggestions(false);
    setSuggestions([]);
  
    // optional: keep this around as "last search"
    setSearchQuery(term);
  
    // 👇 go straight to the set detail page
    navigate(`/sets/${encodeURIComponent(suggestion.set_num)}`);
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

  /* -------------------------------
     Load collections on token change
  --------------------------------*/
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

  /* -------------------------------
     Public lists (Explore)
  --------------------------------*/
  async function loadPublicLists() {
    try {
      setPublicLoading(true);
      setPublicError(null);

      const resp = await fetch(`${API_BASE}/lists/public`);

      if (!resp.ok) {
        throw new Error(`Request failed with status ${resp.status}`);
      }

      const data = await resp.json();
      setLists(data);
    } catch (err) {
      console.error("Error fetching public lists:", err);
      setPublicError(err.message);
    } finally {
      setPublicLoading(false);
    }
  }

  useEffect(() => {
    loadPublicLists();
  }, []);

  /* -------------------------------
     My lists (authed)
  --------------------------------*/
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
          if (resp.status === 404) {
            setMyLists([]);
            return;
          }
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

  /* -------------------------------
     Keyboard: search page pgUp/PgDn via arrows
  --------------------------------*/
  useEffect(() => {
    if (page !== "search" || searchResults.length === 0) {
      return;
    }

    function handleKeyDown(e) {
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") {
        return;
      }

      if (e.key === "ArrowRight") {
        const totalPages =
          searchTotal > 0 ? Math.ceil(searchTotal / searchLimit) : 1;

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
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    page,
    searchResults.length,
    searchTotal,
    searchLimit,
    searchLoading,
    searchPage,
    searchQuery,
    searchSort,
  ]);

  /* -------------------------------
     Create new list
  --------------------------------*/
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

      const resp = await fetch(`${API_BASE}/lists/`, {
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

      if (summary.is_public) {
        await loadPublicLists();
      }
    } catch (err) {
      console.error("Error creating list:", err);
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  }

  /* -------------------------------
     Collection mutations
  --------------------------------*/
  const ownedSetNums = new Set(owned.map((item) => item.set_num));
  const wishlistSetNums = new Set(wishlist.map((item) => item.set_num));

  async function handleMarkOwned(setNum) {
    if (!token) {
      alert("Please log in to track your collection.");
      navigate("/login");
      setPage("login");
      return;
    }

    const alreadyOwned = ownedSetNums.has(setNum);

    try {
      if (alreadyOwned) {
        const resp = await fetch(
          `${API_BASE}/collections/owned/${encodeURIComponent(setNum)}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!resp.ok && resp.status !== 404) {
          const text = await resp.text();
          throw new Error(
            `Failed to remove from Owned (${resp.status}): ${text}`
          );
        }
      } else {
        const resp = await fetch(`${API_BASE}/collections/owned`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ set_num: setNum }),
        });

        if (!resp.ok && resp.status !== 409) {
          const text = await resp.text();
          throw new Error(`Failed to mark owned (${resp.status}): ${text}`);
        }
      }

      await loadCollections(token);
    } catch (err) {
      console.error("Error toggling owned:", err);
      alert(err.message || String(err));
    }
  }

  async function handleAddWishlist(setNum) {
    if (!token) {
      alert("Please log in to track your collection.");
      navigate("/login");
      setPage("login");
      return;
    }

    const alreadyInWishlist = wishlistSetNums.has(setNum);

    try {
      if (alreadyInWishlist) {
        const resp = await fetch(
          `${API_BASE}/collections/wishlist/${encodeURIComponent(setNum)}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!resp.ok && resp.status !== 404) {
          const text = await resp.text();
          throw new Error(
            `Failed to remove from Wishlist (${resp.status}): ${text}`
          );
        }
      } else {
        const resp = await fetch(`${API_BASE}/collections/wishlist`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ set_num: setNum }),
        });

        if (!resp.ok && resp.status !== 409) {
          const text = await resp.text();
          throw new Error(
            `Failed to add to wishlist (${resp.status}): ${text}`
          );
        }
      }

      await loadCollections(token);
    } catch (err) {
      console.error("Error toggling wishlist:", err);
      alert(err.message || String(err));
    }
  }

  async function ensureOwned(setNum) {
    if (!token) return;

    const alreadyOwned = owned.some((item) => item.set_num === setNum);
    if (alreadyOwned) return;

    try {
      const resp = await fetch(`${API_BASE}/collections/owned`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ set_num: setNum }),
      });

      if (!resp.ok && resp.status !== 409) {
        const text = await resp.text();
        throw new Error(`Failed to mark owned (${resp.status}): ${text}`);
      }

      await loadCollections(token);
    } catch (err) {
      console.error("Error ensuring owned:", err);
    }
  }

  /* -------------------------------
     Search core
  --------------------------------*/
  async function runSearch(query, sortKey = searchSort, pageNum = 1) {
    const trimmed = (query || "").trim();
    if (!trimmed) return;

    setPage("search");
    setSearchQuery(trimmed);
    setSearchPage(pageNum);

    window.scrollTo({ top: 0, behavior: "smooth" });

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
        setSearchTotal(Number.isNaN(totalNum) ? items.length : totalNum);
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
    setPage("search");
    navigate("/search");
    await runSearch(searchText, searchSort, 1);
  }

  async function handleSearchSortChange(e) {
    const newSort = e.target.value;
    setSearchSort(newSort);

    if (!searchQuery.trim()) return;
    await runSearch(searchQuery, newSort, 1);
  }

  /* -------------------------------
     Logout
  --------------------------------*/
  function handleLogout() {
    setToken("");
    setMyLists([]);
    setOwned([]);
    setWishlist([]);
  }

  const totalPages =
    searchTotal > 0 ? Math.max(1, Math.ceil(searchTotal / searchLimit)) : 1;

  const isHome = location.pathname === "/";
  const isExplore = location.pathname.startsWith("/explore");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* ========================== TOP NAV ========================== */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          padding: "1rem",
          borderBottom: "1px solid #ddd",
          marginBottom: "1.5rem",
          gap: "1rem",
        }}
      >
      {/* LEFT: main nav links */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <Link
          to="/"
          style={{
            padding: "0.5rem 0.9rem",
            cursor: "pointer",
            textDecoration: "none",
          }}
          onClick={() => setPage("public")}
        >
          🏠 Home
        </Link>

        <Link
          to="/explore"
          style={{
            padding: "0.5rem 0.9rem",
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          🔎 Explore
        </Link>

        <Link
          to="/new"
          style={{
            padding: "0.5rem 0.9rem",
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          ✨ New
        </Link>

        <Link
          to="/sale"
          style={{
            padding: "0.5rem 0.9rem",
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          💸 Sale
        </Link>

        <Link
          to="/retiring"
          style={{
            padding: "0.5rem 0.9rem",
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          ⏳ Retiring soon
        </Link>
      </div>

        {/* RIGHT: search + auth */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ position: "relative" }}>
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

              {showSuggestions && (suggestions.length > 0 || searchText.trim() !== "") && (
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
                    maxHeight: "260px",
                    overflowY: "auto",
                  }}
                >
                  {/* --- Category: Sets --- */}
                  {suggestions.length > 0 && (
                    <>
                      <li
                        style={{
                          padding: "0.35rem 0.75rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "#777",
                        }}
                      >
                        Sets
                      </li>

                      {suggestions.map((s) => (
                        <li
                          key={s.set_num}
                          onMouseDown={() => handleSuggestionClick(s)}
                          style={{
                            padding: "0.5rem 0.75rem",
                            cursor: "pointer",
                            borderBottom: "1px solid #f3f3f3",
                          }}
                        >
                          <strong>{s.name}</strong>
                          <div style={{ fontSize: "0.8rem", color: "#666" }}>
                            {s.set_num} • {s.year}
                          </div>
                        </li>
                      ))}
                    </>
                  )}

                  {/* --- Category: Search all (action row) --- */}
                  {searchText.trim() !== "" && (
                    <li
                      onMouseDown={handleSearchAllClick}
                      style={{
                        padding: "0.5rem 0.75rem",
                        cursor: "pointer",
                        background: suggestions.length === 0 ? "white" : "#fafafa",
                        fontSize: "0.85rem",
                        color: "#444",
                      }}
                    >
                      Search all sets for{" "}
                      <span style={{ fontWeight: 600 }}>"{searchText.trim()}"</span>
                    </li>
                  )}
                </ul>
              )}
          </form>

          {/* Auth / lists links */}
          {!token && (
            <Link
              to="/login"
              style={{
                padding: "0.5rem 0.9rem",
                cursor: "pointer",
                textDecoration: "none",
              }}
              onClick={() => setPage("login")}
            >
              🔐 Login
            </Link>
          )}

          {token && (
            <>
              <Link
                to="/login"
                style={{
                  padding: "0.5rem 0.9rem",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
                onClick={() => setPage("login")}
              >
                📋 My Lists
              </Link>

              <button
                onClick={handleLogout}
                style={{
                  padding: "0.4rem 0.9rem",
                  cursor: "pointer",
                  borderRadius: "999px",
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ========================== MAIN CONTENT ========================== */}
      <div style={{ padding: "1.5rem" }}>
        <Routes>
          {/* HOME */}
          <Route
            path="/"
            element={
              <HomePage
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
              />
            }
          />

          <Route
            path="/collection"
            element={
              <CollectionPage
                owned={owned}
                wishlist={wishlist}
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
              />
            }
          />

          {/* EXPLORE (public lists) */}
          <Route
            path="/explore"
            element={
              <>
                <h1>Explore public lists</h1>
                <p style={{ color: "#666" }}>
                  Browse lists created by other LEGO fans (GET{" "}
                  <code>/lists/public</code>).
                </p>

                {publicLoading && <p>Loading public lists…</p>}
                {publicError && (
                  <p style={{ color: "red" }}>Error: {publicError}</p>
                )}

                {!publicLoading && !publicError && lists.length === 0 && (
                  <p>No public lists yet. Create one from your account page.</p>
                )}

                {!publicLoading && !publicError && lists.length > 0 && (
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
                        <h2 style={{ marginTop: 0, marginBottom: "0.25rem" }}>
                          <Link
                            to={`/lists/${list.id}`}
                            style={{
                              textDecoration: "none",
                              color: "inherit",
                            }}
                          >
                            {list.title}
                          </Link>
                        </h2>
                        <p>
                          Owner: <strong>{list.owner}</strong>
                        </p>
                        <p>
                          Sets in list: <strong>{list.items_count}</strong>
                        </p>
                        <p>
                          Visibility:{" "}
                          <strong>
                            {list.is_public ? "Public" : "Private"}
                          </strong>
                        </p>
                        {list.description && <p>{list.description}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            }
          />

        {/* -------- NEW SETS (placeholder) -------- */}
        <Route
          path="/new"
          element={
            <div>
              <h1>New sets</h1>
              <p style={{ color: "#666" }}>
                A curated feed of the latest releases will go here later.
              </p>
            </div>
          }
        />

        {/* -------- SALE (placeholder) -------- */}
        <Route
          path="/sale"
          element={
            <div>
              <h1>On sale</h1>
              <p style={{ color: "#666" }}>
                Soon this page will highlight sets with the best deals.
              </p>
            </div>
          }
        />

        {/* -------- RETIRING SOON (placeholder) -------- */}
        <Route
          path="/retiring"
          element={
            <div>
              <h1>Retiring soon</h1>
              <p style={{ color: "#666" }}>
                Eventually this page will show sets that are about to retire so
                you can grab them in time.
              </p>
            </div>
          }
        />

          {/* SEARCH RESULTS */}
          <Route
            path="/search"
            element={
              <div>
                <h1>Search Results</h1>

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
                      <strong>
                        {searchTotal === 0
                          ? 0
                          : (searchPage - 1) * searchLimit + 1}
                      </strong>{" "}
                      –{" "}
                      <strong>
                        {searchTotal === 0
                          ? 0
                          : Math.min(searchPage * searchLimit, searchTotal)}
                      </strong>{" "}
                      of <strong>{searchTotal}</strong> results
                    </p>
                  </div>

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

                {!searchLoading &&
                  !searchError &&
                  searchResults.length === 0 && <p>No sets found.</p>}

                {!searchLoading &&
                  !searchError &&
                  searchResults.length > 0 && (
                    <div>
                      <ul
                        style={{
                          listStyle: "none",
                          padding: 0,
                          margin: 0,
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(240px, 1fr))",
                          columnGap: "1rem",
                          rowGap: "1.75rem",
                        }}
                      >
                        {searchResults.map((set) => (
                          <li
                            key={set.set_num}
                            style={{
                              width: "240px",
                              maxWidth: "240px",
                            }}
                          >
                          <SetCard
                            key={set.set_num}
                            set={set}
                            isOwned={ownedSetNums.has(set.set_num)}
                            isInWishlist={wishlistSetNums.has(set.set_num)}
                            onMarkOwned={handleMarkOwned}
                            onAddWishlist={handleAddWishlist}
                            variant="default"
                          />
                        </li>
                        ))}
                      </ul>

                      <Pagination
                        currentPage={searchPage}
                        totalPages={totalPages}
                        totalItems={searchTotal}
                        pageSize={searchLimit}
                        disabled={searchLoading}
                        onPageChange={(p) => {
                          runSearch(searchQuery, searchSort, p);
                        }}
                      />
                    </div>
                  )}
              </div>
            }
          />

          {/* LIST DETAIL PAGE */}
          <Route
            path="/lists/:listId"
            element={
              <ListDetailPage
                token={token}
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
              />
            }
          />

          {/* LOGIN / ACCOUNT */}
          <Route
            path="/login"
            element={
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

                    <p style={{ color: "#666", marginTop: 0 }}>
                      Owned: <strong>{owned.length}</strong> · Wishlist:{" "}
                      <strong>{wishlist.length}</strong> · Custom lists:{" "}
                      <strong>{myLists.length}</strong>
                    </p>

                    <section
                      style={{
                        marginTop: "1rem",
                        marginBottom: "1.5rem",
                      }}
                    >
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
                          <h3 style={{ marginTop: 0 }}>Owned</h3>
                          {collectionsLoading && <p>Loading…</p>}
                          {collectionsError && (
                            <p style={{ color: "red" }}>
                              Error: {collectionsError}
                            </p>
                          )}

                          {!collectionsLoading && !collectionsError && (
                            <>
                              <p>
                                Sets: <strong>{owned.length}</strong>
                              </p>

                              {owned.length === 0 && (
                                <p style={{ color: "#666" }}>
                                  You haven&apos;t marked any sets as Owned
                                  yet.
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
                            </>
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
                          <h3 style={{ marginTop: 0 }}>Wishlist</h3>
                          {collectionsLoading && <p>Loading…</p>}
                          {collectionsError && (
                            <p style={{ color: "red" }}>
                              Error: {collectionsError}
                            </p>
                          )}

                          {!collectionsLoading && !collectionsError && (
                            <>
                              <p>
                                Sets: <strong>{wishlist.length}</strong>
                              </p>

                              {wishlist.length === 0 && (
                                <p style={{ color: "#666" }}>
                                  You haven&apos;t added any sets to your
                                  Wishlist yet.
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
                            </>
                          )}
                        </div>

                        {/* Custom lists */}
                        <div
                          style={{
                            flex: "1 1 260px",
                            border: "1px solid #ddd",
                            borderRadius: "8px",
                            padding: "1rem",
                          }}
                        >
                          <h3 style={{ marginTop: 0 }}>Custom Lists</h3>

                          {myListsLoading && <p>Loading your lists…</p>}
                          {myListsError && (
                            <p style={{ color: "red" }}>
                              Error: {myListsError}
                            </p>
                          )}

                          {!myListsLoading &&
                            !myListsError &&
                            myLists.length === 0 && (
                              <p style={{ color: "#666" }}>
                                You don&apos;t have any custom lists yet.
                              </p>
                            )}

                          {!myListsLoading &&
                            !myListsError &&
                            myLists.length > 0 && (
                              <ul
                                style={{
                                  listStyle: "none",
                                  padding: 0,
                                  marginTop: 0,
                                }}
                              >
                                {myLists.map((list) => (
                                  <li
                                    key={list.id}
                                    style={{
                                      borderBottom: "1px solid #eee",
                                      padding: "0.5rem 0",
                                    }}
                                  >
                                    <div style={{ fontWeight: 600 }}>
                                      {list.title}
                                    </div>
                                    {list.description && (
                                      <div
                                        style={{
                                          fontSize: "0.85rem",
                                          color: "#666",
                                          marginTop: "0.15rem",
                                        }}
                                      >
                                        {list.description}
                                      </div>
                                    )}
                                    <div
                                      style={{
                                        fontSize: "0.8rem",
                                        color: "#777",
                                        marginTop: "0.25rem",
                                      }}
                                    >
                                      {list.items_count} sets ·{" "}
                                      {list.is_public ? "Public" : "Private"}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                        </div>
                      </div>
                    </section>

                    {/* Create-list form */}
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
                        <h3 style={{ marginTop: 0 }}>Create a New List</h3>

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
                            <p
                              style={{
                                color: "red",
                                marginBottom: "0.5rem",
                              }}
                            >
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
                  </div>
                )}
              </div>
            }
          />

          {/* SET DETAIL PAGE */}
          <Route
            path="/sets/:setNum"
            element={
              <SetDetailPage
                token={token}
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
                onEnsureOwned={ensureOwned}
                myLists={myLists}
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default App;