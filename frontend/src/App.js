// We import React + two hooks from React:
// - useState → lets us store values and re-render when they change
// - useEffect → lets us run side-effect code (like fetching from the API)
import React, { useEffect, useState } from "react";
import Login from "./Login"; // our login form component

// Your backend base URL
const API_BASE = "http://localhost:8000";

function App() {
  // -------------------------------
  // STATE VARIABLES (storage)
  // -------------------------------

  // Public lists (from GET /lists/public)
  const [lists, setLists] = useState([]);

  // Loading + error for the PUBLIC lists
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Which "page" the user is on: "public" or "login"
  const [page, setPage] = useState("public");

  // 🔐 Token we get after logging in successfully
  const [token, setToken] = useState(null);

  // "My Lists" data (from GET /lists/me, requires token)
  const [myLists, setMyLists] = useState([]);
  const [myListsLoading, setMyListsLoading] = useState(false);
  const [myListsError, setMyListsError] = useState(null);

  // -------------------------------
  // 1) FETCH PUBLIC LISTS ON PAGE LOAD
  // -------------------------------
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

    // Run once on first render
    fetchPublicLists();
  }, []);

  // -------------------------------
  // 2) FETCH "MY LISTS" WHEN WE HAVE A TOKEN
  // -------------------------------
  useEffect(() => {
    // If user is NOT logged in, don't do anything
    if (!token) {
      setMyLists([]);
      return;
    }

    async function fetchMyLists() {
      try {
        setMyListsLoading(true);
        setMyListsError(null);

        // Call the protected endpoint with the Bearer token
        const resp = await fetch(`${API_BASE}/lists/me`, {
          headers: {
            Authorization: `Bearer ${token}`, // 🔑 send the token here
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to load your lists (status ${resp.status})`);
        }

        const data = await resp.json();
        setMyLists(data);
      } catch (err) {
        console.error("Error fetching my lists:", err);
        setMyListsError(err.message);
      } finally {
        setMyListsLoading(false);
      }
    }

    fetchMyLists();
  }, [token]); // this runs whenever "token" changes

  // Simple logout function
  function handleLogout() {
    setToken(null);
    setMyLists([]);
  }

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
        {/* PUBLIC LISTS tab */}
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

        {/* LOGIN / ACCOUNT tab */}
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
        {/* -------- PUBLIC PAGE -------- */}
        {page === "public" && (
          <>
            <h1>LEGO Lists App</h1>
            <p style={{ color: "#666" }}>
              This page is pulling data directly from your FastAPI backend
              (GET <code>/lists/public</code>).
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

                    {list.description && <p>{list.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* -------- LOGIN / MY ACCOUNT PAGE -------- */}
        {page === "login" && (
          <div>
            <h1>Account</h1>

            {/* If we DON'T have a token yet, show the Login form */}
            {!token && (
              <>
                <p style={{ color: "#666" }}>
                  Log in with your fake user (ethan / lego123).
                </p>
                <Login
                  onLoginSuccess={(accessToken) => {
                    setToken(accessToken);
                    console.log("Logged in! Token:", accessToken);
                  }}
                />
              </>
            )}

            {/* If we DO have a token, show "My Lists" + Logout */}
            {token && (
              <div style={{ marginTop: "1.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <h2>My Lists</h2>
                  <button
                    onClick={handleLogout}
                    style={{
                      padding: "0.25rem 0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    Log out
                  </button>
                </div>

                {/* Loading / error / empty / lists states for MY lists */}
                {myListsLoading && <p>Loading your lists…</p>}

                {myListsError && (
                  <p style={{ color: "red" }}>Error: {myListsError}</p>
                )}

                {!myListsLoading && !myListsError && myLists.length === 0 && (
                  <p>You don&apos;t have any lists yet.</p>
                )}

                {!myListsLoading && !myListsError && myLists.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    {myLists.map((list) => (
                      <li
                        key={list.id}
                        style={{
                          border: "1px solid #ddd",
                          borderRadius: "8px",
                          padding: "1rem",
                          marginBottom: "1rem",
                        }}
                      >
                        <h3>{list.title}</h3>
                        {list.description && <p>{list.description}</p>}
                        <p>
                          Sets in list: <strong>{list.items_count}</strong>
                        </p>
                        <p>
                          Visibility:{" "}
                          <strong>
                            {list.is_public ? "Public" : "Private"}
                          </strong>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Little status message under everything */}
            {token && !myListsLoading && !myListsError && (
              <p style={{ marginTop: "0.5rem", color: "green" }}>
                Logged in: token stored in React state and used for
                <code> /lists/me</code>.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;