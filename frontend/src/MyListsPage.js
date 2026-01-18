import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth";
import { apiFetch } from "./lib/api";

export default function MyListsPage() {
  const { token } = useAuth();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr("");

        // your AccountPage already uses this endpoint
        const data = await apiFetch("/lists/me?include_system=false", { token });
        if (cancelled) return;

        setLists(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load lists");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <h1 style={{ marginTop: 0 }}>My Lists</h1>

      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "red" }}>Error: {err}</p>}

      {!loading && !err && lists.length === 0 && <p style={{ color: "#666" }}>You don’t have any lists yet.</p>}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {lists.map((l) => (
          <Link
            key={l.id}
            to={`/lists/${encodeURIComponent(l.id)}`}
            style={{
              textDecoration: "none",
              color: "inherit",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: "0.9rem",
              background: "white",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 900 }}>{l.title || l.name || "Untitled list"}</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              {(l.items_count ?? l.items?.length ?? 0)} sets · {l.is_public ? "Public" : "Private"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}