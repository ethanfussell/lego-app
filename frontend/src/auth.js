// src/auth.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, getToken as loadToken, setToken as persistToken } from "./lib/api";

const AuthContext = createContext(null);

function isHttpStatus(err, code) {
  return String(err?.message || "").startsWith(String(code));
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => loadToken());
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(false);

  // Keep localStorage in sync with our single source of truth
  useEffect(() => {
    persistToken(token);
  }, [token]);

  // Load /auth/me whenever token changes
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
      } catch (e) {
        // Only clear token if truly unauthorized
        const unauthorized = isHttpStatus(e, 401) || isHttpStatus(e, 403);

        if (!cancelled) {
          setMe(null);
          if (unauthorized) setToken("");
        }
      } finally {
        if (!cancelled) setLoadingMe(false);
      }
    }

    loadMe();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      me,
      loadingMe,
      isAuthed: !!token,
      loginWithToken: (t) => setToken(t || ""),
      logout: () => setToken(""),
    }),
    [token, me, loadingMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}