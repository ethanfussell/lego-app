// frontend/src/PublicListsPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "./lib/api";

function toTime(v) {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function sortPublicLists(arr, sortKey) {
  const copy = Array.isArray(arr) ? [...arr] : [];

  if (sortKey === "most_sets") {
    copy.sort((a, b) => {
      const bc = Number(b?.items_count ?? 0);
      const ac = Number(a?.items_count ?? 0);
      if (bc !== ac) return bc - ac;

      // tie-break: newest
      const bt = toTime(b?.created_at || b?.updated_at);
      const at = toTime(a?.created_at || a?.updated_at);
      return bt - at;
    });
    return copy;
  }

  // default: newest
  copy.sort((a, b) => {
    const bt = toTime(b?.created_at || b?.updated_at);
    const at = toTime(a?.created_at || a?.updated_at);
    if (bt !== at) return bt - at;

    // tie-break: most sets
    const bc = Number(b?.items_count ?? 0);
    const ac = Number(a?.items_count ?? 0);
    return bc - ac;
  });

  return copy;
}

export default function PublicListsPage() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [sortKey, setSortKey] = useState("newest"); // "newest" | "most_sets"

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        const data = await apiFetch("/lists/public");
        if (cancelled) return;
        setLists(Array.isArray(data) ? data : []);
      } catch (e) {
        if (cancelled) return;
        setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const ordered = useMemo(() => sortPublicLists(lists, sortKey), [lists, sortKey]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "baseline",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Public Lists</h1>
          <p style={{ marginTop: 6, color: "#666" }}>Browse lists created by other LEGO fans.</p>
        </div>

        <label style={{ color: "#444", fontSize: 14 }}>
          Sort{" "}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            style={{ padding: "0.25rem 0.5rem" }}
          >
            <option value="newest">Newest</option>
            <option value="most_sets">Most sets</option>
          </select>
        </label>
      </div>

      {loading && <p>Loading public lists…</p>}
      {err && <p style={{ color: "red" }}>Error: {err}</p>}

      {!loading && !err && ordered.length === 0 && <p style={{ color: "#777" }}>No public lists yet.</p>}

      {!loading && !err && ordered.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {ordered.map((l) => {
            const count = Number(l?.items_count ?? 0);
            const to = `/lists/${encodeURIComponent(l.id)}`;
            const owner = l?.owner || l?.owner_username || l?.username || "unknown";

            return (
              <li
                key={l.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 12,
                  background: "white",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                  <div style={{ minWidth: 0 }}>
                    <Link
                      to={to}
                      style={{
                        textDecoration: "none",
                        color: "#111827",
                        fontWeight: 850,
                        lineHeight: "1.15em",
                      }}
                    >
                      {l?.title || "Untitled list"}
                    </Link>

                    <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>
                      by <strong>{owner}</strong> · Public
                    </div>

                    {l?.description ? (
                      <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>{l.description}</div>
                    ) : null}
                  </div>

                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                      color: "#4b5563",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {count} {count === 1 ? "set" : "sets"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}