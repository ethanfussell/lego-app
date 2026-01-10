// frontend/src/Login.js
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export default function Login() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || "/";

  const [username, setUsername] = useState("ethan");
  const [password, setPassword] = useState("lego123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);

      // ✅ FastAPI OAuth2PasswordRequestForm expects x-www-form-urlencoded
      const body = new URLSearchParams();
      body.set("username", username);
      body.set("password", password);

      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Login failed (${resp.status}): ${text}`);
      }

      const data = await resp.json();
      const token = data.access_token || data.token || "";

      if (!token) throw new Error("Login succeeded but no token was returned.");

      loginWithToken(token);

      navigate(returnTo, { replace: true });

      // redirect back if you came from a protected route
      const next = location.state?.from?.pathname || "/collection";
      navigate(next);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 420 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            style={{ padding: "0.55rem 0.65rem", borderRadius: 10, border: "1px solid #d1d5db" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ padding: "0.55rem 0.65rem", borderRadius: 10, border: "1px solid #d1d5db" }}
          />
        </label>

        {error && <div style={{ color: "#b42318" }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            height: 36,
            padding: "0 14px",
            borderRadius: 999,
            border: "none",
            background: loading ? "#6b7280" : "#111827",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 800,
            width: "fit-content",
          }}
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </div>
    </form>
  );
}