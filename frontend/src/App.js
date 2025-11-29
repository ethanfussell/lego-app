// src/App.js
import React, { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

function App() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPublicLists() {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch(`${API_BASE}/lists/public`);
        if (!resp.ok) {
          throw new Error(`Request failed with status ${resp.status}`);
        }

        const data = await resp.json();
        setLists(data);
      } catch (err) {
        console.error("Error fetching public lists:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicLists();
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>LEGO Lists (Public Feed)</h1>
        <p style={{ margin: 0, color: "#555" }}>
          Powered by your FastAPI backend at <code>/lists/public</code>
        </p>
      </header>

      {loading && <p>Loading public lists…</p>}

      {error && (
        <p style={{ color: "red" }}>
          Failed to load lists: {error}
        </p>
      )}

      {!loading && !error && lists.length === 0 && (
        <p>No public lists yet. Try creating some via the backend.</p>
      )}

      {!loading && !error && lists.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {lists.map((list) => (
            <li
              key={list.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                marginBottom: "0.75rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{list.title}</h2>
              <p style={{ margin: "0.25rem 0", color: "#555" }}>
                by <strong>{list.owner}</strong>
              </p>
              <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#666" }}>
                {list.items_count} set{list.items_count === 1 ? "" : "s"} •{" "}
                {list.is_public ? "Public" : "Private"}
              </p>
              {list.description && (
                <p style={{ marginTop: "0.5rem" }}>{list.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;