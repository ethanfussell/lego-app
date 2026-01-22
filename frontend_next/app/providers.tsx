// frontend_next/app/providers.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken as loadToken, setToken as persistToken } from "@/lib/token";
import { isStatus } from "@/lib/http";

type Me = {
  id: number;
  username: string;
};

type AuthContextValue = {
  token: string;
  me: Me | null;
  loadingMe: boolean;
  hydrated: boolean;
  isAuthed: boolean;
  loginWithToken: (t: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: don't read localStorage during the initial render
  const [token, setToken] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);

  // read token AFTER mount (client only)
  useEffect(() => {
    setToken(loadToken());
    setHydrated(true);
  }, []);

  // keep localStorage in sync (only after hydration)
  useEffect(() => {
    if (!hydrated) return;
    persistToken(token);
  }, [token, hydrated]);

  // load /api/users/me whenever token changes (only after hydration)
  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (!hydrated) return;

      if (!token) {
        if (!cancelled) {
          setMe(null);
          setLoadingMe(false);
        }
        return;
      }

      if (!cancelled) setLoadingMe(true);

      try {
        const data = await apiFetch<Me>("/users/me", {
          token,
          cache: "no-store",
        });
        if (!cancelled) setMe(data || null);
      } catch (e) {
        const unauthorized = isStatus(e, 401) || isStatus(e, 403);
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
  }, [token, hydrated]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      me,
      loadingMe,
      hydrated,
      isAuthed: hydrated && !!token,
      loginWithToken: (t) => {
        setMe(null);
        setToken(t || "");
      },
      logout: () => {
        setMe(null);
        setToken("");
      },
    }),
    [token, me, loadingMe, hydrated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}