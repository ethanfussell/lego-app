// frontend/src/ListDetailPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import SetCard from "./SetCard";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

/* ---------------------------
   small helpers
----------------------------*/
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
  return token.startsWith(prefix) ? token.slice(prefix.length) : token;
}

async function apiFetch(path, { token, ...opts } = {}) {
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

async function safeJson(resp) {
  try {
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
  else if (sortKey === "year_desc")
    items.sort((a, b) => Number(b?.year || 0) - Number(a?.year || 0) || byName(a, b));
  else if (sortKey === "year_asc")
    items.sort((a, b) => Number(a?.year || 0) - Number(b?.year || 0) || byName(a, b));
  else if (sortKey === "pieces_desc")
    items.sort((a, b) => Number(b?.pieces || 0) - Number(a?.pieces || 0) || byName(a, b));
  else if (sortKey === "pieces_asc")
    items.sort((a, b) => Number(a?.pieces || 0) - Number(b?.pieces || 0) || byName(a, b));
  else if (sortKey === "rating_desc")
    items.sort(
      (a, b) => Number(b?.average_rating || 0) - Number(a?.average_rating || 0) || byName(a, b)
    );
  else if (sortKey === "rating_asc")
    items.sort(
      (a, b) => Number(a?.average_rating || 0) - Number(b?.average_rating || 0) || byName(a, b)
    );

  return items;
}

/* ==========================================================
   Page
==========================================================*/
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

  // "loading" | "ok" | "not_found" | "error"
  const [listStatus, setListStatus] = useState("loading");
  const [listError, setListError] = useState(null);

  const [setDetails, setSetDetails] = useState([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [setsError, setSetsError] = useState(null);

  const [sortKey, setSortKey] = useState("name_asc");
  const sortedSetDetails = useMemo(() => sortSets(setDetails, sortKey), [setDetails, sortKey]);

  const isOwner = !!list?.owner && !!currentUsername && list.owner === currentUsername;

  /* ---------------------------
     Load list with invisibility rule:
     - Try without auth first (public lists)
     - If 404 and we have token, retry with auth (might be your private list)
     - Otherwise: 404 => not_found
  ----------------------------*/
  async function fetchListWithRules({ cancelled }) {
    if (!listId) return null;

    setListStatus("loading");
    setListError(null);
    setList(null);
    setSetDetails([]);
    setSetsError(null);

    const path = `/lists/${encodeURIComponent(listId)}`;

    const tryResp = async (withToken) => {
      const resp = await apiFetch(path, withToken ? { token: effectiveToken } : undefined);
      return resp;
    };

    try {
      // 1) public attempt (no auth)
      let resp = await tryResp(false);

      // If it looks missing but we have a token, try authed once.
      if (resp.status === 404 && effectiveToken) {
        resp = await tryResp(true);
      }

      if (cancelled()) return null;

      if (resp.ok) {
        const data = await resp.json();
        if (cancelled()) return null;
        setList(data);
        setListStatus("ok");
        return data;
      }

      if (resp.status === 404) {
        // ✅ includes: private list (not owner / logged out), bad id, etc.
        setListStatus("not_found");
        return null;
      }

      // other errors
      const body = await safeJson(resp);
      setListStatus("error");
      setListError(body?.detail || `Failed to load list (status ${resp.status})`);
      return null;
    } catch (err) {
      if (cancelled()) return null;
      setListStatus("error");
      setListError(err?.message || String(err));
      return null;
    }
  }

  async function removeFromList(setNum) {
    if (!effectiveToken) {
      alert("Log in to edit your lists.");
      navigate("/login");
      return;
    }
  
    // optimistic UI
    setSetDetails((prev) => prev.filter((s) => s?.set_num !== setNum));
  
    try {
      const resp = await apiFetch(
        `/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(setNum)}`,
        { token: effectiveToken, method: "DELETE" }
      );
  
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Remove failed (${resp.status}): ${text}`);
      }
  
      // also update list count (optional but nice)
      setList((prev) =>
        prev ? { ...prev, items_count: Math.max(0, countForList(prev) - 1) } : prev
      );
    } catch (e) {
      // rollback by refetching (simple + reliable)
      setSetsError(e?.message || String(e));
      const data = await fetchListWithRules({ cancelled: () => false });
      if (data) await loadSetCards(data, { cancelled: () => false });
    }
  }

  /* ---------------------------
     Load set cards using bulk endpoint
  ----------------------------*/
  async function loadSetCards(listData, { cancelled }) {
    const items = Array.isArray(listData?.items) ? listData.items : [];
    if (items.length === 0) {
      setSetDetails([]);
      return;
    }

    setSetsLoading(true);
    setSetsError(null);

    try {
      const chunkSize = 40;
      const results = [];

      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);

        const params = new URLSearchParams();
        params.set("set_nums", chunk.join(","));

        const resp = await apiFetch(`/sets/bulk?${params.toString()}`, {
          token: effectiveToken ? effectiveToken : undefined,
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Failed to load sets (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        if (Array.isArray(data)) results.push(...data);

        if (cancelled()) return;
      }

      if (cancelled()) return;

      // Preserve list order; bulk may skip missing
      const byNum = new Map(results.map((s) => [s.set_num, s]));
      const ordered = items.map((n) => byNum.get(n)).filter(Boolean);

      if (ordered.length !== items.length) {
        setSetsError(`Loaded ${ordered.length}/${items.length} sets (some set numbers may not exist yet).`);
      }

      setSetDetails(ordered);
    } catch (err) {
      if (cancelled()) return;
      setSetDetails([]);
      setSetsError(err?.message || String(err));
    } finally {
      if (!cancelled()) setSetsLoading(false);
    }
  }

  useEffect(() => {
    let cancelledFlag = false;
    const cancelled = () => cancelledFlag;

    (async () => {
      const data = await fetchListWithRules({ cancelled });
      if (cancelled()) return;
      if (data) await loadSetCards(data, { cancelled });
    })();

    return () => {
      cancelledFlag = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, effectiveToken]);

  /* ---------------------------
     UI states
  ----------------------------*/
  if (listStatus === "loading") {
    return <div style={{ padding: "1.5rem" }}>Loading list…</div>;
  }

  if (listStatus === "not_found") {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p style={{ marginTop: 0 }}>List not found.</p>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: "999px",
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  if (listStatus === "error") {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p style={{ color: "red", marginTop: 0 }}>Error: {listError || "Something went wrong."}</p>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: "999px",
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  // listStatus === "ok"
  if (!list) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p style={{ marginTop: 0 }}>List not found.</p>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: "999px",
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ← Back
        </button>
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
        {!isOwner && (
          <>
            By <strong>{list.owner}</strong> ·{" "}
          </>
        )}
        <strong>{list.is_public ? "Public" : "Private"}</strong> · <strong>{totalCount}</strong>{" "}
        set{totalCount === 1 ? "" : "s"}
      </p>

      {list.description && <p style={{ marginTop: "0.75rem", color: "#444" }}>{list.description}</p>}

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

        {!setsLoading && sortedSetDetails.length === 0 && <p style={{ color: "#777" }}>No sets in this list yet.</p>}

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
              <li key={set.set_num} style={{ maxWidth: 260, position: "relative" }}>
                {isOwner && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromList(set.set_num);
                    }}
                    title="Remove from this list"
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      zIndex: 5,
                      width: 34,
                      height: 34,
                      borderRadius: "999px",
                      border: "1px solid #e5e7eb",
                      background: "white",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    ✕
                  </button>
                )}

                <SetCard
                  set={set}
                  token={effectiveToken}
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