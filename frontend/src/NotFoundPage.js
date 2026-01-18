import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ marginTop: 0, fontSize: "1.8rem" }}>Page not found</h1>
      <p style={{ color: "#6b7280", marginTop: 8 }}>
        Nothing exists at <strong>{pathname}</strong>.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <Link to="/" style={btnStyle}>Home</Link>
        <Link to="/discover" style={btnStyle}>Discover</Link>
        <Link to="/search" style={btnStyle}>Search</Link>
        <Link to="/account" style={btnStyle}>My Account</Link>
      </div>
    </div>
  );
}

const btnStyle = {
  padding: "0.5rem 0.9rem",
  borderRadius: 999,
  border: "1px solid #ddd",
  background: "white",
  textDecoration: "none",
  color: "#111827",
  fontWeight: 800,
};