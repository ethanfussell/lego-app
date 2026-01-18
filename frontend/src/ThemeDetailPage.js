import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import SetCard from "./SetCard";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildPageItems(page, totalPages) {
  // Search-style: show first, last, current +/- 2, ellipses when needed
  const items = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const nums = [...items].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const out = [];
  let prev = 0;
  for (const p of nums) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

// Match SearchPage options, but map to (sort, order)
const SORT_OPTIONS = [
  { key: "relevance", label: "Relevance", sort: "relevance", order: "desc" }, // backend may ignore; ok
  { key: "rating", label: "Rating", sort: "rating", order: "desc" },
  { key: "pieces", label: "Pieces", sort: "pieces", order: "desc" },
  { key: "year", label: "Year", sort: "year", order: "desc" },
  { key: "name", label: "Name", sort: "name", order: "asc" },
];

function ThemeDetailPage({ ownedSetNums, wishlistSetNums, onMarkOwned, onAddWishlist }) {
  const { themeSlug } = useParams();
  const themeName = useMemo(
    () => (themeSlug ? decodeURIComponent(themeSlug) : "Theme"),
    [themeSlug]
  );

  const [searchParams, setSearchParams] = useSearchParams();

  const PAGE_SIZE = 36;

  // URL params
  const page = useMemo(() => {
    const raw = parseInt(searchParams.get("page") || "1", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }, [searchParams]);

  const sortKey = useMemo(() => {
    const raw = (searchParams.get("sortKey") || "").trim();
    const allowed = new Set(SORT_OPTIONS.map((o) => o.key));
    return allowed.has(raw) ? raw : "rating";
  }, [searchParams]);

  // derive backend sort/order from sortKey
  const sortConfig = useMemo(() => {
    return SORT_OPTIONS.find((o) => o.key === sortKey) || SORT_OPTIONS[1];
  }, [sortKey]);

  const [sets, setSets] = useState([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
  const safePage = clamp(page, 1, totalPages);

  // If URL page is out of bounds once we know totalPages, snap it.
  useEffect(() => {
    if (page !== safePage) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(safePage));
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage, totalPages]);

  // Fetch theme sets
  useEffect(() => {
    let cancelled = false;

    async function loadThemeSets() {
      try {
        setLoading(true);
        setError(null);

        const offset = (safePage - 1) * PAGE_SIZE;

        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));
        // pass sort/order through if backend supports it
        if (sortConfig?.sort) params.set("sort", String(sortConfig.sort));
        if (sortConfig?.order) params.set("order", String(sortConfig.order));

        const url = `${API_BASE}/themes/${encodeURIComponent(themeName)}/sets?${params.toString()}`;

        const resp = await fetch(url);
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Theme sets failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        const totalCount = parseInt(resp.headers.get("X-Total-Count") || "0", 10);

        if (!cancelled) {
          setSets(Array.isArray(data) ? data : []);
          setTotal(Number.isFinite(totalCount) ? totalCount : 0);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading theme sets:", err);
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadThemeSets();
    return () => {
      cancelled = true;
    };
  }, [themeName, safePage, sortConfig]);

  const hasResults = sets && sets.length > 0;
  const pageItems = buildPageItems(safePage, totalPages);

  function goToPage(p) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(p));
    setSearchParams(next);
  }

  function handleSortChange(e) {
    const nextSortKey = e.target.value;

    const next = new URLSearchParams(searchParams);
    next.set("sortKey", String(nextSortKey));
    next.set("page", "1"); // reset to first page like SearchPage
    setSearchParams(next);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "baseline", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>{themeName}</h1>
          <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
            {total ? `${total.toLocaleString()} set${total === 1 ? "" : "s"}` : ""}
          </div>
        </div>

        <div style={{ marginTop: 8, marginBottom: 10 }}>
          <Link to="/themes" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 700 }}>
            ← Back to themes
          </Link>
        </div>

        {/* ✅ SearchPage-style sort control (right-aligned) */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <label style={{ fontSize: 14, color: "#444", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#6b7280" }}>Sort</span>
            <select
              value={sortKey}
              onChange={handleSortChange}
              disabled={loading}
              style={{
                padding: "0.35rem 0.6rem",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "white",
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading && <p>Loading sets…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && !hasResults && (
        <p style={{ color: "#777" }}>No sets found for this theme.</p>
      )}

      {!loading && !error && hasResults && (
        <>
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
            {sets.map((set) => (
              <div key={set.set_num} style={{ cursor: "pointer" }}>
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

          {/* Search-style pagination */}
          {totalPages > 1 && (
            <div
              style={{
                marginTop: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => goToPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  background: safePage <= 1 ? "#f3f4f6" : "white",
                  cursor: safePage <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Prev
              </button>

              {pageItems.map((it, idx) => {
                if (it === "…") {
                  return (
                    <span key={`dots-${idx}`} style={{ padding: "0 0.35rem", color: "#6b7280" }}>
                      …
                    </span>
                  );
                }
                const p = it;
                const isActive = p === safePage;
                return (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "10px",
                      border: "1px solid #e5e7eb",
                      background: isActive ? "#111827" : "white",
                      color: isActive ? "white" : "#111827",
                      cursor: isActive ? "default" : "pointer",
                      fontWeight: isActive ? 700 : 500,
                    }}
                    disabled={isActive}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  background: safePage >= totalPages ? "#f3f4f6" : "white",
                  cursor: safePage >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ThemeDetailPage;