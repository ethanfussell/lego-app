// frontend/src/ListDetailPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import SetCard from "./SetCard";
import { useToast } from "./Toast";

const API_BASE = "http://localhost:8000";

function getStoredToken() {
  try {
    return localStorage.getItem("lego_token") || "";
  } catch {
    return "";
  }
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
    return await resp.json();
  } catch {
    return null;
  }
}

function countForList(list) {
  const c = list?.items_count ?? (Array.isArray(list?.items) ? list.items.length : 0);
  return Number.isFinite(c) ? c : 0;
}

function sortSets(arr, sortKey) {
  const items = Array.isArray(arr) ? [...arr] : [];

  const byName = (a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" });

  if (sortKey === "name_asc") items.sort(byName);
  else if (sortKey === "name_desc") items.sort((a, b) => byName(b, a));
  else if (sortKey === "year_desc") items.sort((a, b) => (Number(b?.year || 0) - Number(a?.year || 0)) || byName(a, b));
  else if (sortKey === "year_asc") items.sort((a, b) => (Number(a?.year || 0) - Number(b?.year || 0)) || byName(a, b));
  else if (sortKey === "pieces_desc") items.sort((a, b) => (Number(b?.pieces || 0) - Number(a?.pieces || 0)) || byName(a, b));
  else if (sortKey === "pieces_asc") items.sort((a, b) => (Number(a?.pieces || 0) - Number(b?.pieces || 0)) || byName(a, b));
  else if (sortKey === "rating_desc") items.sort((a, b) => (Number(b?.rating || 0) - Number(a?.rating || 0)) || byName(a, b));
  else if (sortKey === "rating_asc") items.sort((a, b) => (Number(a?.rating || 0) - Number(b?.rating || 0)) || byName(a, b));

  return items;
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
  const { push: toast } = useToast();

  const effectiveToken = token || getStoredToken();
  const currentUsername = useMemo(() => getUsernameFromToken(effectiveToken), [effectiveToken]);

  const [list, setList] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [setDetails, setSetDetails] = useState([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [setsError, setSetsError] = useState(null);

  // ✅ Sort feature (same style as owned/wishlist)
  const [sortKey, setSortKey] = useState("name_asc");
  const sortedSetDetails = useMemo(() => sortSets(setDetails, sortKey), [setDetails, sortKey]);

  const isOwner = !!list?.owner && !!currentUsername && list.owner === currentUsername;

  async function loadList() {
    if (!listId) return null;

    setListLoading(true);
    setListError(null);

    try {
      const resp = await apiFetch(`/lists/${encodeURIComponent(listId)}`, {
        token: effectiveToken || "",
      });

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const data = await loadList();
      if (cancelled) return;
      if (data) await loadSetCards(data);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, effectiveToken]);

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
      {/* ✅ Back button already matches */}
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

      {/* ✅ Hide your name if you're the owner */}
      <p style={{ margin: "0.35rem 0 0 0", color: "#666" }}>
        {!isOwner && (
          <>
            By <strong>{list.owner}</strong> ·{" "}
          </>
        )}
        <strong>{list.is_public ? "Public" : "Private"}</strong> ·{" "}
        <strong>{totalCount}</strong> set{totalCount === 1 ? "" : "s"}
      </p>

      {list.description && <p style={{ marginTop: "0.75rem", color: "#444" }}>{list.description}</p>}

      {/* ✅ Removed the "Edit list" panel entirely */}

      <section style={{ marginTop: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "0.75rem",
          }}
        >
          <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Sets</h2>

          {/* ✅ Sort dropdown added */}
          <label style={{ color: "#444", fontSize: "0.9rem" }}>
            Sort{" "}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              style={{ padding: "0.25rem 0.5rem" }}
            >
              <option value="name_asc">Name (A–Z)</option>
              <option value="name_desc">Name (Z–A)</option>
              <option value="year_desc">Year (new → old)</option>
              <option value="year_asc">Year (old → new)</option>
              <option value="pieces_desc">Pieces (high → low)</option>
              <option value="pieces_asc">Pieces (low → high)</option>
              <option value="rating_desc">Rating (high → low)</option>
              <option value="rating_asc">Rating (low → high)</option>
            </select>
          </label>
        </div>

        {setsLoading && <p>Loading sets…</p>}
        {setsError && <p style={{ color: setsError.startsWith("Loaded") ? "#777" : "red" }}>{setsError}</p>}

        {!setsLoading && sortedSetDetails.length === 0 && (
          <p style={{ color: "#777" }}>No sets in this list yet.</p>
        )}

        {!setsLoading && sortedSetDetails.length > 0 && (
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
            {sortedSetDetails.map((set) => (
              <li key={set.set_num} style={{ maxWidth: 260 }}>
                <SetCard
                  set={set}
                  isOwned={ownedSetNums ? ownedSetNums.has(set.set_num) : false}
                  isInWishlist={wishlistSetNums ? wishlistSetNums.has(set.set_num) : false}
                  onMarkOwned={onMarkOwned}
                  onAddWishlist={onAddWishlist}
                  variant="default"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div style={{ marginTop: "2rem", color: "#777" }}>
        <Link to="/explore" style={{ color: "inherit" }}>
          Browse more public lists →
        </Link>
      </div>
    </div>
  );
}