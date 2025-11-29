import React, { useState } from "react";

const API_BASE = "http://localhost:8000";

function QuickCollectionsAdd({ token, onCollectionsChanged }) {
  const [setNum, setSetNum] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleAdd(type) {
    // type is "owned" or "wishlist"
    if (!token) {
      setError("You must be logged in.");
      return;
    }
    if (!setNum.trim()) {
      setError("Please enter a set number.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const url = `${API_BASE}/collections/${type}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ set_num: setNum.trim() }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed (${resp.status}): ${text}`);
      }

      const data = await resp.json();
      setMessage(
        `Added ${data.set_num} to ${type === "owned" ? "Owned" : "Wishlist"}`
      );
      setSetNum("");

      // 🔁 tell parent to refresh Owned/Wishlist
      if (onCollectionsChanged) {
        onCollectionsChanged();
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        background: "#fafafa",
        maxWidth: "420px",
      }}
    >
      <h2>Quick add to your collections</h2>
      <p style={{ color: "#666" }}>
        Type a LEGO set number (like 10305-1) and add it to your Owned or
        Wishlist collections.
      </p>

      <input
        type="text"
        placeholder="Set number (e.g. 10305-1)"
        value={setNum}
        onChange={(e) => setSetNum(e.target.value)}
        style={{
          width: "100%",
          padding: "0.5rem",
          marginBottom: "0.5rem",
          borderRadius: "4px",
          border: "1px solid #ccc",
        }}
      />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <button
          type="button"
          onClick={() => handleAdd("owned")}
          disabled={loading}
        >
          Owned
        </button>
        <button
          type="button"
          onClick={() => handleAdd("wishlist")}
          disabled={loading}
        >
          Wishlist
        </button>
      </div>

      {loading && <p>Working…</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </section>
  );
}

export default QuickCollectionsAdd;