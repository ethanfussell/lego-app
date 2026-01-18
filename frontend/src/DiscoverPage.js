// frontend/src/DiscoverPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "./lib/api";

function Tile({ title, desc, to }) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: "inherit",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: "1rem",
        background: "white",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{title}</div>
      <div style={{ color: "#6b7280", fontSize: 14, lineHeight: "1.35em" }}>{desc}</div>
    </Link>
  );
}

function ListCard({ list }) {
  const title = list?.title || list?.name || "Untitled list";
  const count = Number(list?.items_count ?? 0);
  const owner = list?.owner || list?.owner_username || list?.username || null;

  return (
    <Link
      to={`/lists/${encodeURIComponent(list.id)}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: "0.9rem",
        background: "white",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900, lineHeight: "1.2em" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
          {count === 1 ? "1 set" : `${count} sets`}
        </div>
      </div>

      {owner ? <div style={{ fontSize: 13, color: "#6b7280" }}>by {owner}</div> : null}

      {list?.description ? (
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: "1.35em" }}>{list.description}</div>
      ) : null}
    </Link>
  );
}

export default function DiscoverPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // store full list results (not sliced)
  const [publicListsRaw, setPublicListsRaw] = useState([]);

  // ✅ new: sort control (applies to preview)
  const [sortKey, setSortKey] = useState("newest"); // "newest" | "most_sets"

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const data = await apiFetch("/lists/public");
        const arr = Array.isArray(data) ? data : [];
        if (!cancelled) setPublicListsRaw(arr);
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
  }, []);

  const sortedPublicLists = useMemo(() => {
    const arr = Array.isArray(publicListsRaw) ? [...publicListsRaw] : [];

    if (sortKey === "most_sets") {
      arr.sort((a, b) => Number(b?.items_count || 0) - Number(a?.items_count || 0));
      return arr;
    }

    // default: newest (use updated_at, fallback to created_at)
    arr.sort((a, b) => {
      const ad = new Date(a?.updated_at || a?.created_at || 0).getTime();
      const bd = new Date(b?.updated_at || b?.created_at || 0).getTime();
      return bd - ad;
    });

    return arr;
  }, [publicListsRaw, sortKey]);

  // ✅ preview stays 6, but now sorted
  const publicLists = useMemo(() => sortedPublicLists.slice(0, 6), [sortedPublicLists]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>
      <h1 style={{ margin: 0 }}>Discover</h1>
      <p style={{ color: "#666", marginTop: "0.4rem" }}>
        Find sets to track — and browse lists created by other LEGO fans.
      </p>

      {/* Set discovery shortcuts */}
      <section style={{ marginTop: "1.25rem" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Browse sets</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <Tile title="New sets" desc="Latest sets (placeholder feed for now)." to="/new" />
          <Tile title="On sale" desc="Curated deals feed (placeholder)." to="/sale" />
          <Tile title="Retiring soon" desc="Older sets that may retire soon (placeholder)." to="/retiring-soon" />
          <Tile title="Themes" desc="Browse sets by theme." to="/themes" />
        </div>
      </section>

      {/* Community lists */}
      <section style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Community lists</div>
            <div style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>Public lists from other users.</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* ✅ new: sort */}
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "#444" }}>
              Sort
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                style={{ padding: "0.25rem 0.5rem" }}
              >
                <option value="newest">Newest</option>
                <option value="most_sets">Most sets</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => navigate("/discover/lists")}
              style={{
                padding: "0.35rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              View all
            </button>
          </div>
        </div>

        {loading && <p style={{ marginTop: 12 }}>Loading public lists…</p>}
        {err && <p style={{ marginTop: 12, color: "red" }}>Error: {err}</p>}

        {!loading && !err && publicLists.length === 0 && (
          <p style={{ marginTop: 12, color: "#777" }}>No public lists yet.</p>
        )}

        {!loading && !err && publicLists.length > 0 && (
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {publicLists.map((l) => (
              <ListCard key={l.id} list={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}