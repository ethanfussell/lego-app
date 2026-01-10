// src/App.js
// Main React app for LEGO tracker

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Link, NavLink, useNavigate } from "react-router-dom";
import { apiFetch } from "./lib/api";
import { useAuth } from "./auth";
import RequireAuth from "./RequireAuth";

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
import ProfileMenu from "./ProfileMenu";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

/**
 * Convert any set_num into the "plain" form (no -1).
 * "31216-1" -> "31216"
 * "31216"   -> "31216"
 */
function toPlainSetNum(setNum) {
  const s = String(setNum || "").trim();
  if (!s) return "";
  return s.includes("-") ? s.split("-")[0] : s;
}

/**
 * Membership check that works no matter if caller uses "31216" or "31216-1".
 */
function hasSetNum(setSetNums, setNum) {
  const raw = String(setNum || "").trim();
  if (!raw) return false;
  const plain = toPlainSetNum(raw);
  return setSetNums.has(raw) || setSetNums.has(plain);
}

function NavBar() {
  const { me, logout } = useAuth();

  return (
    <div>
      {me ? (
        <>
          <span>Logged in as {me.username}</span>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <span>Not logged in</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   Reusable horizontal row of SetCards (with scroll arrows)
-------------------------------------------------------- */
function SetRow({ title, subtitle, sets, ownedSetNums, wishlistSetNums, onMarkOwned, onAddWishlist }) {
  const scrollerRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const safeSets = Array.isArray(sets) ? sets : [];

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const recompute = () => {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      setCanLeft(el.scrollLeft > 2);
      setCanRight(el.scrollLeft < maxScroll - 2);
    };

    recompute();
    el.addEventListener("scroll", recompute, { passive: true });
    window.addEventListener("resize", recompute);

    return () => {
      el.removeEventListener("scroll", recompute);
      window.removeEventListener("resize", recompute);
    };
  }, [safeSets.length]);

  if (safeSets.length === 0) return null;

  function scrollByCards(dir) {
    const el = scrollerRef.current;
    if (!el) return;

    const cardWidth = 220;
    const gap = 12; // ~0.75rem
    const delta = dir * (cardWidth + gap) * 2; // ~2 cards per click
    el.scrollBy({ left: delta, behavior: "smooth" });
  }

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
            <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.9rem", color: "#6b7280" }}>{subtitle}</p>
          )}
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => scrollByCards(-1)}
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
            boxShadow: "0 6px 16px rgba(0,0,0,0.10)",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() => scrollByCards(+1)}
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
            boxShadow: "0 6px 16px rgba(0,0,0,0.10)",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ›
        </button>

        <div ref={scrollerRef} style={{ overflowX: "auto", paddingBottom: "0.5rem" }}>
          <ul style={{ display: "flex", gap: "0.75rem", listStyle: "none", padding: 0, margin: 0 }}>
            {safeSets.map((set) => {
              const full = set?.set_num || "";
              const plain = toPlainSetNum(full);
              const key = full || `${set?.name || "set"}-${plain}`;

              return (
                <li key={key} style={{ minWidth: "220px", maxWidth: "220px", flex: "0 0 auto" }}>
                  <SetCard
                    set={set}
                    isOwned={hasSetNum(ownedSetNums, full)}
                    isInWishlist={hasSetNum(wishlistSetNums, full)}
                    onMarkOwned={onMarkOwned}
                    onAddWishlist={onAddWishlist}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------
   Home page
-------------------------------------------------------- */
function HomePage({ ownedSetNums, wishlistSetNums, onMarkOwned, onAddWishlist }) {
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
        if (!cancelled) setHomeError(err?.message || String(err));
      } finally {
        if (!cancelled) setHomeLoading(false);
      }
    }

    fetchHomeSets();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <section style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Track your LEGO world</h1>
        <p style={{ marginTop: "0.5rem", color: "#666", maxWidth: "560px" }}>
          Log your collection, wishlist, and reviews. Discover deals, sets retiring soon, and what&apos;s trending with
          other fans.
        </p>
        <p style={{ marginTop: "0.4rem", fontSize: "0.8rem", color: "#9ca3af" }}>
          Home feed placeholder · later this will be personalized and pull real prices.
        </p>
      </section>

      {homeLoading && <p>Loading sets…</p>}
      {homeError && <p style={{ color: "red" }}>Error loading homepage: {homeError}</p>}

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

  // Page mode
  const [page, setPage] = useState("home");

  // Auth token
  const { token, me, logout } = useAuth();

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

  /**
   * IMPORTANT:
   * membership sets include BOTH formats (plain + full)
   * so any existing code checking either way continues working.
   */
  const ownedSetNums = useMemo(() => {
    const s = new Set();
    for (const x of owned) {
      const full = String(x?.set_num || "").trim();
      const plain = toPlainSetNum(full);
      if (full) s.add(full);
      if (plain) s.add(plain);
    }
    return s;
  }, [owned]);

  const wishlistSetNums = useMemo(() => {
    const s = new Set();
    for (const x of wishlist) {
      const full = String(x?.set_num || "").trim();
      const plain = toPlainSetNum(full);
      if (full) s.add(full);
      if (plain) s.add(plain);
    }
    return s;
  }, [wishlist]);

  // Search results
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchSort, setSearchSort] = useState("relevance");
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const searchLimit = 50;

  function getOrderForSort(sortKey) {
    if (sortKey === "rating" || sortKey === "pieces" || sortKey === "year") return "desc";
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
    setTimeout(() => setShowSuggestions(false), 150);
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

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        setSuggestionsError(null);

        const resp = await fetch(`${API_BASE}/sets/suggest?q=${encodeURIComponent(trimmed)}`);
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Suggest failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch (err) {
        setSuggestionsError(err?.message || String(err));
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
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
  
      const ownedData = await apiFetch("/collections/me/owned", { token: currentToken });
      setOwned(Array.isArray(ownedData) ? ownedData : []);
  
      const wishlistData = await apiFetch("/collections/me/wishlist", { token: currentToken });
      setWishlist(Array.isArray(wishlistData) ? wishlistData : []);
    } catch (err) {
      setCollectionsError(err?.message || String(err));
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
  
      const data = await apiFetch("/lists/public");
      setLists(Array.isArray(data) ? data : []);
    } catch (err) {
      setPublicError(err?.message || String(err));
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

    let cancelled = false;

    async function fetchMyLists() {
      try {
        setMyListsLoading(true);
        setMyListsError(null);

        try {
          const data = await apiFetch("/lists/me", { token });
          if (!cancelled) setMyLists(Array.isArray(data) ? data : []);
        } catch (err) {
          // backend uses 404 when user has no lists yet
          if (String(err?.message || "").startsWith("404")) {
            if (!cancelled) setMyLists([]);
            return;
          }
          throw err;
        }
      } catch (err) {
        if (!cancelled) setMyListsError(err?.message || String(err));
      } finally {
        if (!cancelled) setMyListsLoading(false);
      }
    }

    fetchMyLists();

    return () => {
      cancelled = true;
    };
  }, [token]);

  /* -------------------------------
     Keyboard pagination on search page
  --------------------------------*/
  useEffect(() => {
    if (page !== "search" || searchResults.length === 0) return;

    function handleKeyDown(e) {
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "ArrowRight") {
        const totalPagesLocal = searchTotal > 0 ? Math.ceil(searchTotal / searchLimit) : 1;
        if (!searchLoading && searchPage < totalPagesLocal) {
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
  }, [page, searchResults.length, searchTotal, searchLimit, searchLoading, searchPage, searchQuery, searchSort]);

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

      if (summary.is_public) await loadPublicLists();
    } catch (err) {
      setCreateError(err?.message || String(err));
    } finally {
      setCreateLoading(false);
    }
  }

  /* -------------------------------
     Collection DELETE helper
     IMPORTANT: always send PLAIN to backend; treat 404 as "already removed"
  --------------------------------*/
  async function deleteCollectionItem(kind, setNum, currentToken) {
    if (!currentToken) return;
  
    const plain = toPlainSetNum(setNum);
  
    try {
      await apiFetch(`/collections/${kind}/${encodeURIComponent(plain)}`, {
        method: "DELETE",
        token: currentToken,
      });
    } catch (err) {
      // treat 404 as "already removed"
      if (String(err?.message || "").startsWith("404")) return;
      throw err;
    }
  }

  /* -------------------------------
     Collection mutations (TOGGLES)
  --------------------------------*/
  async function handleMarkOwned(setNum) {
    if (!token) {
      alert("Please log in to track your collection.");
      navigate("/login");
      setPage("login");
      return;
    }
  
    const plain = toPlainSetNum(setNum);
    const alreadyOwned = hasSetNum(ownedSetNums, setNum);
  
    try {
      if (alreadyOwned) {
        await deleteCollectionItem("owned", plain, token);
        await loadCollections(token);
        return;
      }
  
      try {
        await apiFetch("/collections/owned", {
          method: "POST",
          token,
          body: { set_num: plain },
        });
      } catch (err) {
        // backend may return 409 if already owned (treat as success)
        if (!String(err?.message || "").startsWith("409")) throw err;
      }
  
      await loadCollections(token);
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  async function handleAddWishlist(setNum) {
    if (!token) {
      alert("Please log in to track your collection.");
      navigate("/login");
      setPage("login");
      return;
    }
  
    const plain = toPlainSetNum(setNum);
    const alreadyInWishlist = wishlistSetNums.has(setNum) || wishlistSetNums.has(plain);
  
    try {
      if (alreadyInWishlist) {
        await deleteCollectionItem("wishlist", plain, token);
        await loadCollections(token);
        return;
      }
  
      try {
        await apiFetch("/collections/wishlist", {
          method: "POST",
          token,
          body: { set_num: plain },
        });
      } catch (err) {
        // backend may return 409 if already in wishlist (treat as success)
        if (!String(err?.message || "").startsWith("409")) throw err;
      }
  
      await loadCollections(token);
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  // Used by SetDetailPage
  async function onRemoveWishlist(setNum) {
    if (!token) return;
    try {
      await deleteCollectionItem("wishlist", setNum, token);
      await loadCollections(token);
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  // Used by SetDetailPage
  async function ensureOwned(setNum) {
    if (!token) return;
  
    const plain = toPlainSetNum(setNum);
    if (hasSetNum(ownedSetNums, plain)) return;
  
    try {
      try {
        await apiFetch("/collections/owned", {
          method: "POST",
          token,
          body: { set_num: plain },
        });
      } catch (err) {
        // backend may return 409 if already owned (treat as success)
        if (!String(err?.message || "").startsWith("409")) throw err;
      }
  
      await loadCollections(token);
    } catch (err) {
      alert(err?.message || String(err));
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
      setSearchError(err?.message || String(err));
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
    logout();
    setMyLists([]);
    setOwned([]);
    setWishlist([]);
  }

  const totalPages = searchTotal > 0 ? Math.max(1, Math.ceil(searchTotal / searchLimit)) : 1;

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
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <NavLink to="/" style={getNavLinkStyle} end onClick={() => setPage("home")}>
            Home
          </NavLink>

          <NavLink to="/explore" style={getNavLinkStyle} onClick={() => setPage("public")}>
            Explore
          </NavLink>

          <NavLink to="/themes" style={getNavLinkStyle}>
            Themes
          </NavLink>

          <NavLink to="/new" style={getNavLinkStyle}>
            New
          </NavLink>

          <NavLink to="/sale" style={getNavLinkStyle}>
            Sale
          </NavLink>

          <NavLink to="/retiring-soon" style={getNavLinkStyle}>
            Retiring soon
          </NavLink>

          <NavLink to="/collection" style={getNavLinkStyle} onClick={() => setPage("collection")}>
            Collection
          </NavLink>
        </div>

        {/* RIGHT: search + auth */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}>
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
                {suggestionsLoading && (
                  <li style={{ padding: "0.45rem 0.75rem", fontSize: "0.8rem", color: "#6b7280" }}>
                    Searching…
                  </li>
                )}

                {suggestionsError && (
                  <li style={{ padding: "0.45rem 0.75rem", fontSize: "0.8rem", color: "red" }}>
                    Error: {suggestionsError}
                  </li>
                )}

                {!suggestionsLoading && !suggestionsError && suggestions.length > 0 && (
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

                {!suggestionsLoading && searchText.trim() !== "" && !suggestionsError && (
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
                    Search all sets for <span style={{ fontWeight: 600 }}>"{searchText.trim()}"</span>
                  </li>
                )}
              </ul>
            )}
          </form>

          {!token ? (
            <Link
              to="/login"
              style={{ padding: "0.5rem 0.9rem", cursor: "pointer", textDecoration: "none" }}
            >
              🔐 Login
            </Link>
          ) : (
            <ProfileMenu me={me} onLogout={handleLogout} />
          )}
        </div>
      </nav>

      {/* ========================== MAIN CONTENT ========================== */}
      <div style={{ padding: "1.5rem" }}>
        <Routes>
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

          <Route
            path="/sale"
            element={
              <FeedPage
                title="On sale (placeholder)"
                description="For now this shows a curated slice of highly-rated sets. Later, this will filter by real discounts and affiliate data."
                queryParams={{ q: "lego", sort: "rating", order: "desc", page: 1, limit: 50 }}
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
                variant="sale"
              />
            }
          />

          <Route
            path="/retiring-soon"
            element={
              <FeedPage
                title="Retiring soon"
                description="Right now this approximates older sets. Later, we'll plug in real retiring flags."
                queryParams={{ q: "lego", sort: "year", order: "asc", page: 1, limit: 50 }}
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
              />
            }
          />

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

          <Route
            path="/explore"
            element={
              <>
                <h1>Explore public lists</h1>
                <p style={{ color: "#666" }}>
                  Browse lists created by other LEGO fans (GET <code>/lists/public</code>).
                </p>

                {publicLoading && <p>Loading public lists…</p>}
                {publicError && <p style={{ color: "red" }}>Error: {publicError}</p>}

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
                          <Link to={`/lists/${list.id}`} style={{ textDecoration: "none", color: "inherit" }}>
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
                          Visibility: <strong>{list.is_public ? "Public" : "Private"}</strong>
                        </p>
                        {list.description && <p>{list.description}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            }
          />

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

                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem", color: "#666" }}>
                      Showing <strong>{searchTotal === 0 ? 0 : (searchPage - 1) * searchLimit + 1}</strong> –{" "}
                      <strong>{searchTotal === 0 ? 0 : Math.min(searchPage * searchLimit, searchTotal)}</strong> of{" "}
                      <strong>{searchTotal}</strong> results
                    </p>
                  </div>

                  <div>
                    <label>
                      Sort by{" "}
                      <select value={searchSort} onChange={handleSearchSortChange} style={{ padding: "0.25rem 0.5rem" }}>
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
                {searchError && <p style={{ color: "red" }}>Error: {searchError}</p>}

                {!searchLoading && !searchError && searchResults.length === 0 && <p>No sets found.</p>}

                {!searchLoading && !searchError && searchResults.length > 0 && (
                  <div>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        columnGap: "1rem",
                        rowGap: "1.75rem",
                      }}
                    >
                      {searchResults.map((set) => {
                        const full = set?.set_num || "";
                        const plain = toPlainSetNum(full);
                        const key = full || `${set?.name || "set"}-${plain}`;

                        return (
                          <li key={key} style={{ width: "240px", maxWidth: "240px" }}>
                            <SetCard
                              set={set}
                              isOwned={hasSetNum(ownedSetNums, full)}
                              isInWishlist={hasSetNum(wishlistSetNums, full)}
                              onMarkOwned={handleMarkOwned}
                              onAddWishlist={handleAddWishlist}
                              variant="default"
                            />
                          </li>
                        );
                      })}
                    </ul>

                    <Pagination
                      currentPage={searchPage}
                      totalPages={totalPages}
                      totalItems={searchTotal}
                      pageSize={searchLimit}
                      disabled={searchLoading}
                      onPageChange={(p) => runSearch(searchQuery, searchSort, p)}
                    />
                  </div>
                )}
              </div>
            }
          />

          <Route
            path="/collection"
            element={
              <RequireAuth>
                <CollectionsPage
                  ownedSets={owned}
                  wishlistSets={wishlist}
                  onMarkOwned={handleMarkOwned}
                  onAddWishlist={handleAddWishlist}
                />
              </RequireAuth>
            }
          />

          <Route
            path="/collection/owned"
            element={
              <RequireAuth>
                <OwnedPage
                  ownedSets={owned}
                  ownedSetNums={ownedSetNums}
                  wishlistSetNums={wishlistSetNums}
                  onMarkOwned={handleMarkOwned}
                  onAddWishlist={handleAddWishlist}
                />
              </RequireAuth>
            }
          />

          <Route
            path="/collection/wishlist"
            element={
              <RequireAuth>
                <WishlistPage
                  wishlistSets={wishlist}
                  ownedSetNums={ownedSetNums}
                  wishlistSetNums={wishlistSetNums}
                  onMarkOwned={handleMarkOwned}
                  onAddWishlist={handleAddWishlist}
                />
              </RequireAuth>
            }
          />

          <Route
            path="/lists/:listId"
            element={
              <RequireAuth>
              <ListDetailPage
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
              />
              </RequireAuth>
           }
         />

          <Route
            path="/login"
            element={
              <div>
                <h1>Account</h1>

                {!token && (
                  <>
                    <p style={{ color: "#666" }}>Log in with your fake user (ethan / lego123).</p>
                    <Login />
                  </>
                )}

                {token && (
                  <div style={{ marginTop: "1.5rem" }}>
                    <p style={{ color: "#666", marginTop: 0 }}>
                      Owned: <strong>{owned.length}</strong> · Wishlist: <strong>{wishlist.length}</strong> · Custom lists:{" "}
                      <strong>{myLists.length}</strong>
                    </p>

                    {collectionsLoading && <p>Loading collections…</p>}
                    {collectionsError && <p style={{ color: "red" }}>Error: {collectionsError}</p>}
                    {myListsError && <p style={{ color: "red" }}>Lists error: {myListsError}</p>}

                    {showCreateForm && (
                      <form onSubmit={handleCreateList} style={{ marginTop: 12, maxWidth: 520 }}>
                        <div style={{ display: "grid", gap: 10 }}>
                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: "0.9rem", color: "#333" }}>Title</span>
                            <input
                              value={newListTitle}
                              onChange={(e) => setNewListTitle(e.target.value)}
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
                              value={newListDescription}
                              onChange={(e) => setNewListDescription(e.target.value)}
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
                              checked={newListIsPublic}
                              onChange={(e) => setNewListIsPublic(e.target.checked)}
                            />
                            <span style={{ fontSize: "0.9rem", color: "#333" }}>Public (shows up in Explore)</span>
                          </label>

                          {createError && <div style={{ color: "red" }}>{createError}</div>}

                          <button
                            type="submit"
                            disabled={createLoading}
                            style={{
                              padding: "0.5rem 0.9rem",
                              borderRadius: "999px",
                              border: "none",
                              background: createLoading ? "#888" : "#111827",
                              color: "white",
                              cursor: createLoading ? "not-allowed" : "pointer",
                              fontWeight: 700,
                              width: "fit-content",
                            }}
                          >
                            {createLoading ? "Creating…" : "Create list"}
                          </button>
                        </div>
                      </form>
                    )}

                    {!showCreateForm && (
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(true)}
                        style={{
                          marginTop: 12,
                          padding: "0.45rem 0.9rem",
                          borderRadius: "999px",
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        ➕ Create list
                      </button>
                    )}

                    {myListsLoading && <p style={{ marginTop: 10 }}>Loading your lists…</p>}
                  </div>
                )}
              </div>
            }
          />

          <Route
            path="/sets/:setNum"
            element={
              <SetDetailPage
                ownedSetNums={ownedSetNums}
                wishlistSetNums={wishlistSetNums}
                onMarkOwned={handleMarkOwned}
                onAddWishlist={handleAddWishlist}
                onRemoveWishlist={onRemoveWishlist}
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