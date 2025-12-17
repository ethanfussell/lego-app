// frontend/src/OwnedPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SetCard from "./SetCard";

const API_BASE = "http://localhost:8000";

function extractSetNum(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item.set_num === "string") return item.set_num;
  return "";
}

function looksLikeFullSet(item) {
  // "full set" from /sets/{set_num} usually has at least name/year/theme
  return item && typeof item === "object" && !!item.name;
}

async function fetchSetDetail(setNum) {
  try {
    const resp = await fetch(`${API_BASE}/sets/${encodeURIComponent(setNum)}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export default function OwnedPage({
  ownedSets = [],
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const navigate = useNavigate();

  const setNums = useMemo(() => {
    return (ownedSets || []).map(extractSetNum).filter(Boolean);
  }, [ownedSets]);

  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // If backend already returned full set objects, use them directly.
      const allFull = (ownedSets || []).every(looksLikeFullSet);
      if (allFull) {
        setDetails(ownedSets);
        setLoading(false);
        setErr(null);
        return;
      }

      if (!setNums.length) {
        setDetails([]);
        setLoading(false);
        setErr(null);
        return;
      }

      try {
        setLoading(true);
        setErr(null);

        const full = await Promise.all(setNums.map(fetchSetDetail));
        const filtered = full.filter(Boolean);

        if (!cancelled) setDetails(filtered);
      } catch (e) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ownedSets, setNums]);

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Owned</h1>
          <p style={{ margin: "0.35rem 0 0 0", color: "#666" }}>
            All sets you’ve marked as Owned.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>

          <Link
            to="/collection"
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              textDecoration: "none",
              color: "inherit",
              display: "inline-block",
            }}
          >
            Collection hub
          </Link>
        </div>
      </div>

      <div style={{ marginTop: "1rem", color: "#777" }}>
        Total: <strong>{setNums.length}</strong>
      </div>

      {loading && <p style={{ marginTop: "1rem" }}>Loading owned sets…</p>}
      {err && (
        <p style={{ marginTop: "1rem", color: "red" }}>
          Error loading owned sets: {err}
        </p>
      )}

      {!loading && !err && setNums.length === 0 && (
        <p style={{ marginTop: "1rem", color: "#777" }}>
          You haven’t marked any sets as Owned yet.
        </p>
      )}

      {!loading && !err && details.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "1rem 0 0 0",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
            alignItems: "start",
          }}
        >
          {details.map((set) => (
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
    </div>
  );
}