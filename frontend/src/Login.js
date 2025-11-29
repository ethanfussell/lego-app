// Login.js
// This component is responsible ONLY for:
// - showing a username/password form
// - calling the backend /auth/login when the form is submitted
// - reporting the token (or error) back up to App

import { useState } from "react";

function Login({ onLoginSuccess }) {
  // Local state just for this form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // For showing feedback to the user
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault(); // stop the page from reloading

    setLoading(true);
    setError(null);

    try {
      const resp = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // The backend tests use username/password in JSON
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Login failed with status ${resp.status}`);
      }

      const data = await resp.json();

      // Expecting something like: { access_token: "...", token_type: "bearer" }
      if (!data.access_token) {
        throw new Error("No access_token returned from server");
      }

      // Tell the parent (App) "hey, I logged in successfully"
      onLoginSuccess(data.access_token);

    } catch (err) {
      console.error("Login error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400 }}>
      <h2>Login</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Username<br />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ethan"
            />
          </label>
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Password<br />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="lego123"
            />
          </label>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
    </div>
  );
}

export default Login;