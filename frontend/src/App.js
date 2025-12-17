// src/App.js
// Main React app for LEGO tracker

import React, { useEffect, useState, useRef } from "react";
import { Routes, Route, Link, NavLink, useNavigate } from "react-router-dom";

import Login from "./Login";
import Pagination from "./Pagination";
import SetDetailPage from "./SetDetailPage";
import SetCard from "./SetCard";
import ListDetailPage from "./ListDetailPage";
import ThemesPage from "./ThemesPage";
import ThemeDetailPage from "./ThemeDetailPage";
import FeedPage from "./FeedPage";
import NewSetsPage from "./NewSetsPage";
import CollectionsPage from "./CollectionsPage";
import OwnedPage from "./OwnedPage";
import WishlistPage from "./WishlistPage";

const API_BASE = "http://localhost:8000";

/* -------------------------------------------------------
   Reusable horizontal row of SetCards
-------------------------------------------------------- */
function SetRow({
  title,
  subtitle,
  sets,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  if (!sets || sets.length === 0) return null;

  return (
    <section style={{ marginBottom: "1.9rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.5rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
          {subtitle && (
            <p
              style={{
                margin: "0.2rem 0 0 0",
                fontSize: "0.9rem",
                color: "#6b7280",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
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
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------
   Home page
-------------------------------------------------------- */
function HomePage({
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const [featuredSets, setFeaturedSets] = React.useState([]);
  const [dealsSets, setDealsSets] = React.useState([]);
  const [retiringSets, setRetiringSets] = React.useState([]);
  const [trendingSets, setTrendingSets] = React.useState([]);
  const [homeLoading, setHomeLoading] = React.useState(false);
  const [homeError, setHomeError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchHomeSets() {
      try {
        setHomeLoading(true);
        setHomeError(null);

        const params = new URLSearchParams();
        params.set("q", "lego");
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
        <p
          style={{
            marginTop: "0.4rem",
            fontSize: "0.8rem",
            color: "#9ca3af",
          }}
        >
          Home feed placeholder · later this will be personalized and pull real
          prices.
        </p>
      </section>

      {homeLoading && <p>Loading sets…</p>}
      {homeError && (
        <p style={{ color: "red" }}>Error loading homepage: {homeError}</p>
      )}

      <SetRow
        title="Featured sets"
        subtitle="Highly-rated sets across all themes."
        sets={featuredSets}
        ownedSetNums={ownedSetNums}
        wishlistSetNums={wishlistSetNums}
        onMarkOwned={onMarkOwned}
        onAddWishlist={onAddWishlist}
      />

      <SetRow
        title="Deals & price drops"
        subtitle="Placeholder: likely to become your “best current deal” row."
        sets={dealsSets}
        ownedSetNums={ownedSetNums}
        wishlistSetNums={wishlistSetNums}
        onMarkOwned={onMarkOwned}
        onAddWishlist={onAddWishlist}
      />

      <SetRow
        title="Retiring soon"
        subtitle="Older sets that might not stick around forever."
        sets={retiringSets}
        ownedSetNums={ownedSetNums}
        wishlistSetNums={wishlistSetNums}
        onMarkOwned={onMarkOwned}
        onAddWishlist={onAddWishlist}
      />

      <SetRow
        title="Trending right now"
        subtitle="Another slice of top-rated sets as a stand-in for real trends."
        sets={trendingSets}
        ownedSetNums={ownedSetNums}
        wishlistSetNums={wishlistSetNums}
        onMarkOwned={onMarkOwned}
        onAddWishlist={onAddWishlist}
      />
    </div>
  );
}

/* -------------------------------------------------------
   Main App
-------------------------------------------------------- */
function App() {
  const navigate = useNavigate();

  // Public lists (Explore)
  const [lists, setLists] = useState([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState(null);

  // Page mode (used for search keyboard stuff)
  const [page, setPage] = useState("home");

  // Auth token
  const [token, setToken] = useState(() => {
    return localStorage.getItem("lego_token") || "";
  });

  // Search bar + suggestions
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef(null);

  // My lists (authed)
  const [myLists, setMyLists] = useState([]);
  const [myListsLoading, setMyListsLoading] = useState(false);
  const [myListsError, setMyListsError] = useState(null);

  // Create-list form
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [newListIsPublic, setNewListIsPublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Collections (Owned / Wishlist)
  const [owned, setOwned] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState(null);

  // Search results
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchSort, setSearchSort] = useState("relevance");
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const searchLimit = 50;

  // Persist token
  useEffect(() => {
    if (token) {
      localStorage.setItem("lego_token", token);
    } else {
      localStorage.removeItem("lego_token");
    }
  }, [token]);

  function getOrderForSort(sortKey) {
    if (sortKey === "rating" || sortKey === "pieces" || sortKey === "year") {
      return "desc";
    }
    return "asc";
  }

  // ----- Nav link active styles -----
  const navLinkBaseStyle = {
    padding: "0.5rem 0.9rem",
    cursor: "pointer",
    textDecoration: "none",
    borderRadius: "999px",
    fontSize: "0.9rem",
  };

  function getNavLinkStyle({ isActive }) {
    return {
      ...navLinkBaseStyle,
      backgroundColor: isActive ? "#111827" : "transparent",
      color: isActive ? "#ffffff" : "#111827",
      fontWeight: isActive ? 600 : 400,
    };
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
    runSearch(trimmed, searchSort, 1);
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
    setSuggestions([]);
    setSearchQuery(term);

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
     Keyboard pagination on search page
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
          <NavLink
            to="/"
            style={getNavLinkStyle}
            end
            onClick={() => setPage("home")}
          >
            Home
          </NavLink>

          <NavLink
            to="/explore"
            style={getNavLinkStyle}
            onClick={() => setPage("public")}
          >
            Explore
          </NavLink>

          <NavLink
            to="/themes"
            style={getNavLinkStyle}
          >
            Themes
          </NavLink>

          <NavLink
            to="/new"
            style={getNavLinkStyle}
          >
            New
          </NavLink>

          <NavLink
            to="/sale"
            style={getNavLinkStyle}
          >
            Sale
          </NavLink>

          <NavLink
            to="/retiring-soon"
            style={getNavLinkStyle}
          >
            Retiring soon
          </NavLink>

          <NavLink
            to="/collection"
            style={getNavLinkStyle}
          >
            Collection
          </NavLink>
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

            {showSuggestions &&
              (suggestions.length > 0 || searchText.trim() !== "") && (
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
                  {/* Loading / error states */}
                  {suggestionsLoading && (
                    <li
                      style={{
                        padding: "0.45rem 0.75rem",
                        fontSize: "0.8rem",
                        color: "#6b7280",
                      }}
                    >
                      Searching…
                    </li>
                  )}

                  {suggestionsError && (
                    <li
                      style={{
                        padding: "0.45rem 0.75rem",
                        fontSize: "0.8rem",
                        color: "red",
                      }}
                    >
                      Error: {suggestionsError}
                    </li>
                  )}

                  {/* Category: Sets */}
                  {!suggestionsLoading &&
                    !suggestionsError &&
                    suggestions.length > 0 && (
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
                            <div
                              style={{ fontSize: "0.8rem", color: "#666" }}
                            >
                              {s.set_num} • {s.year}
                            </div>
                          </li>
                        ))}
                      </>
                    )}

                  {/* Category: Search all */}
                  {!suggestionsLoading &&
                    searchText.trim() !== "" &&
                    !suggestionsError && (
                      <li
                        onMouseDown={handleSearchAllClick}
                        style={{
                          padding: "0.5rem 0.75rem",
                          cursor: "pointer",
                          background:
                            suggestions.length === 0 ? "white" : "#fafafa",
                          fontSize: "0.85rem",
                          color: "#444",
                        }}
                      >
                        Search all sets for{" "}
                        <span style={{ fontWeight: 600 }}>
                          "{searchText.trim()}"
                        </span>
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
                My Lists
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

          {/* NEW SETS */}
          <Route
            path="/new"
            element={
              <NewSetsPage
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
              />
            }
          />

          {/* SALE */}
          <Route
            path="/sale"
            element={
              <FeedPage
                title="On sale (placeholder)"
                description="For now this shows a curated slice of highly-rated sets. Later, this will filter by real discounts and affiliate data."
                queryParams={{
                  q: "lego",
                  sort: "rating",
                  order: "desc",
                  page: 1,
                  limit: 50,
                }}
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
                variant="sale"
              />
            }
          />

          {/* RETIRING SOON */}
          <Route
            path="/retiring-soon"
            element={
              <FeedPage
                title="Retiring soon"
                description="Right now this approximates older sets. Later, we'll plug in real retiring flags."
                queryParams={{
                  q: "lego",
                  sort: "year",
                  order: "asc", // older first
                  page: 1,
                  limit: 50,
                }}
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
              />
            }
          />

          {/* THEMES */}
          <Route path="/themes" element={<ThemesPage />} />

          <Route
            path="/themes/:themeSlug"
            element={
              <ThemeDetailPage
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

            <Route
              path="/collection"
              element={
                <CollectionsPage
                  ownedSets={owned}
                  wishlistSets={wishlist}
                  token={token}
                />
              }
            />

            <Route
              path="/collection/owned"
              element={
                <OwnedPage
                  ownedSets={owned}
                  ownedSetNums={ownedSetNums}
                  wishlistSetNums={wishlistSetNums}
                  onMarkOwned={handleMarkOwned}
                  onAddWishlist={handleAddWishlist}
                />
              }
            />

            <Route
              path="/collection/wishlist"
              element={
                <WishlistPage
                  wishlistSets={wishlist}
                  ownedSetNums={ownedSetNums}
                  wishlistSetNums={wishlistSetNums}
                  onMarkOwned={handleMarkOwned}
                  onAddWishlist={handleAddWishlist}
                />
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
                          <h3 style={{ marginTop: 0 }}>
                            <Link
                              to="/collection/owned"
                              style={{ textDecoration: "none", color: "inherit" }}
                            >
                              Owned →
                            </Link>
                          </h3>
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
                          <h3 style={{ marginTop: 0 }}>
                            <Link
                              to="/collection/wishlist"
                              style={{ textDecoration: "none", color: "inherit" }}
                            >
                              Wishlist →
                            </Link>
                          </h3>
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
                                      <Link
                                        to={`/lists/${list.id}`}
                                        style={{ textDecoration: "none", color: "inherit" }}
                                      >
                                        {list.title}
                                      </Link>
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