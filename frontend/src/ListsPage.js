import React, { useEffect, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function getStoredToken() {
  return localStorage.getItem("lego_token") || "";
}

async function apiFetch(path, { token, ...opts } = {}) {
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

export default function ListsPage({ token }) {
  const effectiveToken = token || getStoredToken();

  const [publicLists, setPublicLists] = useState([]);
  const [myLists, setMyLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const pubResp = await apiFetch("/lists/public");
      const pub = await pubResp.json();
      setPublicLists(Array.isArray(pub) ? pub : []);

      if (effectiveToken) {
        const meResp = await apiFetch("/lists/me", { token: effectiveToken });
        const me = await meResp.json();
        setMyLists(Array.isArray(me) ? me : []);
      } else {
        setMyLists([]);
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createList(e) {
    e.preventDefault();
    if (!effectiveToken) {
      setCreateErr("Log in first (needs your fake token).");
      return;
    }
    if (!title.trim()) {
      setCreateErr("Title is required.");
      return;
    }

    try {
      setCreating(true);
      setCreateErr(null);

      const resp = await apiFetch("/lists", {
        token: effectiveToken,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          is_public: isPublic,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Create failed (${resp.status}): ${txt}`);
      }

      setTitle("");
      setDescription("");
      setIsPublic(true);
      await load();
    } catch (e) {
      setCreateErr(e.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div style={{ padding: "1.25rem" }}>Loading lists…</div>;

  return (
    <div style={{ padding: "1.25rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Lists</h1>

      {/* Create */}
      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: "1rem", background: "#fafafa" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Create a list</h2>

        <form onSubmit={createList} style={{ display: "grid", gap: "0.6rem" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="List title (e.g. 'My Favorites')"
            style={{ padding: "0.55rem 0.7rem", borderRadius: 10, border: "1px solid #ddd" }}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            style={{ padding: "0.55rem 0.7rem", borderRadius: 10, border: "1px solid #ddd" }}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#444" }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Public
          </label>

          {createErr && <div style={{ color: "red" }}>{createErr}</div>}

          <button
            type="submit"
            disabled={creating}
            style={{
              width: "fit-content",
              padding: "0.45rem 0.9rem",
              borderRadius: 999,
              border: "1px solid #222",
              background: creating ? "#777" : "#222",
              color: "white",
              cursor: creating ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {creating ? "Creating…" : "Create list"}
          </button>
        </form>
      </section>

      {err && <p style={{ color: "red" }}>Error: {err}</p>}

      {/* My lists */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>My lists</h2>
        {!effectiveToken && <p style={{ color: "#666" }}>Log in to see your lists.</p>}
        {effectiveToken && myLists.length === 0 && <p style={{ color: "#666" }}>No lists yet.</p>}

        {myLists.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.6rem" }}>
            {myLists.map((l) => (
              <li key={l.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: "0.75rem" }}>
                <div style={{ fontWeight: 700 }}>{l.title}</div>
                {l.description && <div style={{ color: "#666" }}>{l.description}</div>}
                <div style={{ color: "#777", fontSize: "0.9rem", marginTop: 4 }}>
                  {l.items_count} item{l.items_count === 1 ? "" : "s"} · {l.is_public ? "Public" : "Private"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Public lists */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Public lists</h2>
        {publicLists.length === 0 && <p style={{ color: "#666" }}>No public lists yet.</p>}

        {publicLists.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.6rem" }}>
            {publicLists.map((l) => (
              <li key={l.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: "0.75rem" }}>
                <div style={{ fontWeight: 700 }}>{l.title}</div>
                {l.description && <div style={{ color: "#666" }}>{l.description}</div>}
                <div style={{ color: "#777", fontSize: "0.9rem", marginTop: 4 }}>
                  by <strong>{l.owner}</strong> · {l.items_count} item{l.items_count === 1 ? "" : "s"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}