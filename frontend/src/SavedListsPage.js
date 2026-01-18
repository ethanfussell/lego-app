import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth";
import { apiFetch } from "./lib/api";

function readSavedIds() {
  try {
    const raw = localStorage.getItem("saved_list_ids");
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function SavedListsPage() {
  const { token } = useAuth();

  // IMPORTANT: keep ids in state so the page updates in the same tab
  const [savedIds, setSavedIds] = useState(() => readSavedIds());

  const [lists, setLists] = useState([]);
  const [missingCount, setMissingCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Refresh ids whenever localStorage changes.
  // NOTE: real "storage" fires in other tabs; you also dispatchEvent(new Event("storage"))
  // in the same tab — this will catch that too.
  useEffect(() => {
    function refresh() {
      setSavedIds(readSavedIds());
    }
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr("");
        setMissingCount(0);

        if (savedIds.length === 0) {
          setLists([]);
          return;
        }

        const results = await Promise.allSettled(
          savedIds.map((id) => apiFetch(`/lists/${encodeURIComponent(id)}`, { token }))
        );

        if (cancelled) return;

        const ok = [];
        let missing = 0;

        for (const r of results) {
          if (r.status === "fulfilled" && r.value) ok.push(r.value);
          else missing += 1;
        }

        setLists(ok);
        setMissingCount(missing);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load saved lists");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, savedIds]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ marginTop: 0 }}>Saved Lists</h1>

        <Link
          to="/discover/lists"
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: 999,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "#111827",
            fontWeight: 800,
            height: "fit-content",
          }}
        >
          Browse community lists
        </Link>
      </div>

      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "red" }}>Error: {err}</p>}

      {!loading && !err && savedIds.length === 0 && (
        <p style={{ color: "#666" }}>You haven’t saved any lists yet.</p>
      )}

      {!loading && !err && savedIds.length > 0 && lists.length === 0 && (
        <div style={{ marginTop: 12, color: "#666" }}>
          <p style={{ margin: 0 }}>None of your saved lists could be loaded.</p>
          <p style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
            They may have been deleted or set to private.
          </p>
        </div>
      )}

      {!loading && !err && missingCount > 0 && lists.length > 0 && (
        <p style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>
          {missingCount} saved list{missingCount === 1 ? "" : "s"} couldn’t be loaded (deleted/private).
        </p>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {lists.map((l) => {
          const id = l?.id;
          const title = l?.title || l?.name || "Untitled list";
          const itemsCount = Array.isArray(l?.items) ? l.items.length : (l?.items_count ?? 0);
          const owner = l?.owner || l?.owner_username || l?.username || "—";
          const isPublic = !!l?.is_public;

          if (!id) return null;

          return (
            <Link
              key={String(id)}
              to={`/lists/${encodeURIComponent(id)}`}
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
              <div style={{ fontWeight: 900 }}>{title}</div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                {itemsCount} sets · {isPublic ? "Public" : "Private"} · by {owner}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}