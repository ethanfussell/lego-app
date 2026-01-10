// src/RequireAuth.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth";

export default function RequireAuth({ children }) {
  const { token, loadingMe } = useAuth();
  const location = useLocation();

  // Optional: while /auth/me is loading, don’t flicker
  if (loadingMe) return <div style={{ padding: "1.5rem" }}>Checking session…</div>;

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}