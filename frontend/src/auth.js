// src/auth.js
// Auth context powered by Clerk.
// Exposes the same { token, me, loadingMe, isAuthed, logout } shape
// that every consumer already depends on.

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/clerk-react";
import { apiFetch } from "./lib/api";

const AuthContext = createContext(null);

// Fallback provider when Clerk is not configured
export function NoClerkAuthProvider({ children }) {
  const value = useMemo(() => ({
    token: "",
    me: null,
    loadingMe: false,
    isAuthed: false,
    clerkUser: null,
    logout: () => {},
  }), []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }) {
  const { isLoaded: authLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { isLoaded: userLoaded, user: clerkUser } = useClerkUser();

  const [token, setToken] = useState("");
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  // Refresh the session token whenever Clerk auth state changes
  useEffect(() => {
    let cancelled = false;

    async function syncToken() {
      if (!authLoaded) return;

      if (!isSignedIn) {
        if (!cancelled) {
          setToken("");
          setMe(null);
          setLoadingMe(false);
        }
        return;
      }

      try {
        const jwt = await getToken();
        if (!cancelled) setToken(jwt || "");
      } catch {
        if (!cancelled) setToken("");
      }
    }

    syncToken();
    return () => { cancelled = true; };
  }, [authLoaded, isSignedIn, getToken]);

  // Load /auth/me from our backend whenever we get a fresh token
  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (!token) {
        if (!cancelled) {
          setMe(null);
          setLoadingMe(false);
        }
        return;
      }

      if (!cancelled) setLoadingMe(true);

      try {
        const data = await apiFetch("/auth/me", { token });
        if (!cancelled) setMe(data || null);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoadingMe(false);
      }
    }

    loadMe();
    return () => { cancelled = true; };
  }, [token]);

  const value = useMemo(() => ({
    token,
    me,
    loadingMe: !authLoaded || !userLoaded || loadingMe,
    isAuthed: !!token && isSignedIn,
    clerkUser: clerkUser || null,
    logout: () => signOut(),
  }), [token, me, loadingMe, authLoaded, userLoaded, isSignedIn, clerkUser, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
