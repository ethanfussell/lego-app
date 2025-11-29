// frontend/src/Login.js
import React, { useState } from "react";

// This should match your backend URL
const API_BASE = "http://localhost:8000";

function Login({ onLoginSuccess }) {
  // Local state for the form fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Local state for UI feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // This runs when you submit the form
  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser from reloading the page
    setLoading(true);
    setError(null);

    try {
      // 🔑 IMPORTANT: OAuth2PasswordRequestForm expects *form data*,
      // not JSON. We build a URL-encoded body like: username=ethan&password=lego123
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          // Tell FastAPI this is form-encoded data
          "Content-Type": "application/x-www-form-urlencoded",
        },
        // Send the URL-encoded string as the body
        body: formData.toString(),
      });

      if (!resp.ok) {
        // If login fails (wrong password, etc.)
        throw new Error(`Login failed with status ${resp.status}`);
      }

      const data = await resp.json();
      // data should look like: { access_token: "fake-token-for-ethan", token_type: "bearer" }

      if (onLoginSuccess) {
        onLoginSuccess(data.access_token);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: "320px",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <label>
        <div>Username</div>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ethan"
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </label>

      <label>
        <div>Password</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="lego123"
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "0.5rem 1rem",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Logging in..." : "Log In"}
      </button>

      {error && (
        <p style={{ color: "red", marginTop: "0.5rem" }}>Error: {error}</p>
      )}
    </form>
  );
}

export default Login;