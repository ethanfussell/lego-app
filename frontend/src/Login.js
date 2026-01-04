// frontend/src/Login.js
import React, { useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("ethan");
  const [password, setPassword] = useState("lego123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 🔑 Backend expects form data (OAuth2PasswordRequestForm),
      // NOT JSON.
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);

      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Login failed (${resp.status})`);
      }

      const data = await resp.json(); // { access_token, token_type }

      if (onLoginSuccess) {
        onLoginSuccess(data.access_token);
      }

      console.log("✅ Logged in, token:", data.access_token);
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        maxWidth: "320px",
        marginTop: "1rem",
      }}
    >
      <div style={{ marginBottom: "0.75rem" }}>
        <label
          style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}
        >
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label
          style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}
        >
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />
      </div>

      {error && (
        <p style={{ color: "red", marginBottom: "0.5rem" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "0.5rem 1rem",
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Logging in…" : "Log in"}
      </button>

      <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#777" }}>
        Try <code>ethan</code> / <code>lego123</code>.
      </p>
    </form>
  );
}

export default Login;