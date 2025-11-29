// We are importing 3 things from React itself:
//
// 1. React → the main React engine
// 2. useState → lets us store values (like lists, loading, errors)
// 3. useEffect → lets us run code automatically when the page loads
import React, { useEffect, useState } from "react";
import Login from "./Login";

// This is just your backend URL saved to a variable
// So if it ever changes, you only change it here
const API_BASE = "http://localhost:8000";

function App() {
  // -------------------------------
  // STATE VARIABLES (storage)
  // -------------------------------

  // Holds the array of public lists from the backend
  const [lists, setLists] = useState([]);

  // True while we're loading data from the API
  const [loading, setLoading] = useState(true);

  // Holds any error message if the API fails
  const [error, setError] = useState(null);

  // Controls which "page" we are viewing in the UI
  // "public" → show public lists
  // "login"  → show login form
  const [page, setPage] = useState("public");

  // Store the token once we log in
  const [token, setToken] = useState(null);

  // -------------------------------
  // AUTOMATIC API CALL ON PAGE LOAD
  // -------------------------------

  useEffect(() => {
    // This function talks to your FastAPI backend
    async function fetchPublicLists() {
      try {
        // Turn on loading
        setLoading(true);
        setError(null);

        // Call your backend
        const resp = await fetch(`${API_BASE}/lists/public`);

        // If the backend returns an error code, stop
        if (!resp.ok) {
          throw new Error(`Request failed with status ${resp.status}`);
        }

        // Convert the JSON response into real JS objects
        const data = await resp.json();

        // Store that data into our "lists" variable
        setLists(data);
      } catch (err) {
        // If anything breaks, store the error message
        console.error("Error fetching public lists:", err);
        setError(err.message);
      } finally {
        // Turn off loading no matter what
        setLoading(false);
      }
    }

    // Actually run the function we just defined
    fetchPublicLists();
  }, []); // [] means "run this once when the page first loads"

  // -------------------------------
  // WHAT THE USER ACTUALLY SEES
  // -------------------------------

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* ==========================
          TOP NAVIGATION BAR
         ========================== */}
      <nav
        style={{
          display: "flex",
          gap: "1rem",
          padding: "1rem",
          borderBottom: "1px solid #ddd",
          marginBottom: "1.5rem",
        }}
      >
        {/* This is the PUBLIC LISTS tab */}
        <button
          onClick={() => setPage("public")}
          style={{
            padding: "0.5rem 1rem",
            cursor: "pointer",
            fontWeight: page === "public" ? "bold" : "normal",
          }}
        >
          🌍 Public Lists
        </button>

        {/* This is the Login / My Lists tab */}
        <button
          onClick={() => setPage("login")}
          style={{
            padding: "0.5rem 1rem",
            cursor: "pointer",
            fontWeight: page === "login" ? "bold" : "normal",
          }}
        >
          🔐 Login / My Lists
        </button>
      </nav>

      {/* ==========================
          MAIN PAGE CONTENT
         ========================== */}
      <div style={{ padding: "1.5rem" }}>
        {/* ---------- PUBLIC LISTS PAGE ---------- */}
        {page === "public" && (
          <>
            <h1>LEGO Lists App</h1>
            <p style={{ color: "#666" }}>
              This page is pulling data directly from your FastAPI backend.
            </p>

            {/* Show loading message */}
            {loading && <p>Loading public lists…</p>}

            {/* Show error message */}
            {error && <p style={{ color: "red" }}>Error: {error}</p>}

            {/* If everything worked AND there are no lists */}
            {!loading && !error && lists.length === 0 && (
              <p>No public lists yet. Create one in the backend.</p>
            )}

            {/* If everything worked AND we have lists */}
            {!loading && !error && lists.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {lists.map((list) => (
                  <li
                    key={list.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      padding: "1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <h2>{list.title}</h2>

                    <p>
                      Owner: <strong>{list.owner}</strong>
                    </p>

                    <p>
                      Sets in list: <strong>{list.items_count}</strong>
                    </p>

                    <p>
                      Visibility:{" "}
                      <strong>{list.is_public ? "Public" : "Private"}</strong>
                    </p>

                    {/* Only show description if it exists */}
                    {list.description && <p>{list.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* ---------- LOGIN PAGE ---------- */}
        {page === "login" && (
          <div>
            <h1>Account</h1>
            {/* Pass a callback to save the token in App state */}
            <Login
              onLoginSuccess={(accessToken) => {
                setToken(accessToken);
                // For now, just log it and stay on this page
                console.log("Logged in! Token:", accessToken);
              }}
            />

            {token && (
              <p style={{ marginTop: "1rem", color: "green" }}>
                Logged in! Token stored in state.
              </p>
            )}
          </div>
        )}
      </div> /* ✅ close the padding div */
    </div>   /* ✅ close the outer wrapper div */
  );
}

export default App;