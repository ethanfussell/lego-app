// frontend/src/SearchPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SetCard from "./SetCard";
import Pagination from "./Pagination";

const RECENT_KEY = "recent_searches_v1";
const MAX_RECENTS = 5;

// You can tweak these anytime
const POPULAR_TERMS = ["Star Wars", "Botanical", "Icons", "Technic", "Modular", "Castle", "Space", "Harry Potter"];

function readRecents() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(String).map((s) => s.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeRecents(next) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function pushRecent(term) {
  const t = String(term || "").trim();
  if (!t) return readRecents();

  const prev = readRecents();
  const deduped = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())];
  const sliced = deduped.slice(0, MAX_RECENTS);
  writeRecents(sliced);
  return sliced;
}

export default function SearchPage({
  // query + results
  searchQuery,
  searchResults,
  searchLoading,
  searchError,

  // sort + paging
  searchSort,
  onChangeSort, // (newSort) => void
  searchPage,
  totalPages,
  searchTotal,

  // actions
  onRunSearch, // (query, sortKey, pageNum) => Promise<void> | void

  // collection wiring
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,

  // optional (so Pagination can show correct range)
  pageSize = 50,
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Support /search?q=lego
  const urlQ = (params.get("q") || "").trim();

  // local input (so the page has its own search box)
  const initialQ = (searchQuery || urlQ || "").trim();
  const [input, setInput] = useState(initialQ);

  // keep input in sync when URL changes (back/forward, clicking chips, etc.)
  useEffect(() => {
    const next = (searchQuery || urlQ || "").trim();
    setInput(next);
  }, [searchQuery, urlQ]);

  // recents
  const [recents, setRecents] = useState(() => readRecents());

  useEffect(() => {
    function onStorage() {
      setRecents(readRecents());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const effectiveQ = (searchQuery || urlQ || "").trim();

  const heading = useMemo(() => {
    return effectiveQ ? `Search: "${effectiveQ}"` : "Search";
  }, [effectiveQ]);

  async function run(term, sortKey = searchSort, pageNum = 1) {
    const q = String(term || "").trim();
    if (!q) return;

    // run search
    await onRunSearch?.(q, sortKey, pageNum);

    // update URL (keep it simple; App state stays source of truth)
    navigate(`/search?q=${encodeURIComponent(q)}`);

    // update recents
    const nextRecents = pushRecent(q);
    setRecents(nextRecents);
    // notify other listeners in this tab (some pages listen to "storage")
    window.dispatchEvent(new Event("storage"));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await run(input, searchSort, 1);
  }

  async function handleSortChange(e) {
    const next = e.target.value;
    onChangeSort?.(next);

    if (!effectiveQ) return;
    await run(effectiveQ, next, 1);
  }

  async function goToPage(p) {
    if (!effectiveQ) return;
    await onRunSearch?.(effectiveQ, searchSort, p);
    navigate(`/search?q=${encodeURIComponent(effectiveQ)}`);
  }

  const showEmptyPrompt = !searchLoading && !searchError && !effectiveQ;
  const showNoResults = !searchLoading && !searchError && !!effectiveQ && (searchResults?.length || 0) === 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header + Search box */}
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0 }}>{heading}</h1>
        <div style={{ color: "#6b7280", marginTop: 6, fontSize: 14 }}>
          {effectiveQ && searchTotal != null
            ? `${searchTotal.toLocaleString()} result${searchTotal === 1 ? "" : "s"}`
            : ""}
        </div>

        {/* On-page search box */}
        <form
          onSubmit={handleSubmit}
          style={{
            marginTop: 12,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search sets (e.g. castle, space, technic)…"
            style={{
              flex: 1,
              padding: "0.7rem 0.85rem",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              outline: "none",
              fontSize: 15,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "0.7rem 1.0rem",
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Search
          </button>
        </form>

        {/* Sort moved UNDER search box, right-aligned (above results) */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <label style={{ fontSize: 14, color: "#444", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#6b7280" }}>Sort</span>
            <select
              value={searchSort}
              onChange={handleSortChange}
              disabled={!effectiveQ || searchLoading}
              style={{
                padding: "0.35rem 0.6rem",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "white",
              }}
            >
              <option value="relevance">Relevance</option>
              <option value="rating">Rating</option>
              <option value="pieces">Pieces</option>
              <option value="year">Year</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* LEFT: Sticky sidebar */}
        <aside style={{ position: "sticky", top: 18, alignSelf: "start" }}>
          {/* Popular */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 12,
              background: "white",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Popular right now</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {POPULAR_TERMS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => run(t, searchSort, 1)}
                  style={{
                    padding: "0.3rem 0.6rem",
                    borderRadius: 999,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                  title={`Search "${t}"`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Recent searches RIGHT under Popular (tight spacing) */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Recent</div>

              {recents.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 13, lineHeight: "1.3em" }}>
                  No recent searches yet.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {recents.slice(0, MAX_RECENTS).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => run(t, searchSort, 1)}
                      style={{
                        textAlign: "left",
                        padding: "0.35rem 0.55rem",
                        borderRadius: 10,
                        border: "1px solid #f1f5f9",
                        background: "#f8fafc",
                        cursor: "pointer",
                        fontWeight: 800,
                        fontSize: 13,
                        color: "#111827",
                      }}
                      title={`Search "${t}"`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT: Results */}
        <main>
          {searchLoading && <p style={{ marginTop: 0 }}>Loading…</p>}
          {searchError && !searchLoading && <p style={{ marginTop: 0, color: "red" }}>Error: {searchError}</p>}

          {showEmptyPrompt && (
            <div style={{ marginTop: 6, color: "#666" }}>
              Type a search above or click a Popular chip to explore sets.
            </div>
          )}

          {showNoResults && (
            <div style={{ marginTop: 6, color: "#666" }}>
              No results found. Try a different search.
            </div>
          )}

          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, 220px)",
              gap: 14,
              justifyContent: "start",
              alignItems: "start",
            }}
          >
            {(searchResults || []).map((set) => (
              <div
                key={set.set_num}
                onClick={() => navigate(`/sets/${encodeURIComponent(set.set_num)}`)}
                style={{ cursor: "pointer" }}
              >
                <SetCard
                  set={set}
                  isOwned={ownedSetNums?.has?.(set.set_num)}
                  isInWishlist={wishlistSetNums?.has?.(set.set_num)}
                  onMarkOwned={onMarkOwned}
                  onAddWishlist={onAddWishlist}
                  variant="default"
                />
              </div>
            ))}
          </div>

          {/* Pagination (uses your Pagination.js prop names) */}
          {effectiveQ && totalPages > 1 && (
            <Pagination
              currentPage={searchPage}
              totalPages={totalPages}
              totalItems={searchTotal || 0}
              pageSize={pageSize}
              disabled={!!searchLoading}
              onPageChange={goToPage}
            />
          )}
        </main>
      </div>
    </div>
  );
}