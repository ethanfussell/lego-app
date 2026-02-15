// frontend_next/app/providers.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken as loadToken, setToken as persistToken } from "@/lib/token";

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

function normalizeToken(t: unknown): string {
  return typeof t === "string" ? t.trim() : "";
}

function getStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const v = (err as { status?: unknown }).status;
  return typeof v === "number" ? v : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Keep token empty until after mount to avoid SSR/localStorage access warnings.
  const [token, setToken] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);

  // Prevent older /me responses from overwriting newer state
  const meReqId = useRef(0);

  // 1) Hydrate token from storage after mount
  useEffect(() => {
    const t = normalizeToken(loadToken());
    setToken(t);
    setHydrated(true);
  }, []);

  // 2) Persist token changes after hydration
  useEffect(() => {
    if (!hydrated) return;
    persistToken(token); // lib/token should remove when empty
  }, [token, hydrated]);

  // 3) Load /users/me when token changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;

    if (!token) {
      setMe(null);
      setLoadingMe(false);
      return;
    }

    let cancelled = false;
    const reqId = ++meReqId.current;

    (async () => {
      setLoadingMe(true);

      try {
        const data = await apiFetch<Me>("/users/me", { token, cache: "no-store" });

        if (cancelled) return;
        if (reqId !== meReqId.current) return;

        setMe(data ?? null);
      } catch (e: unknown) {
        if (cancelled) return;
        if (reqId !== meReqId.current) return;

        const status = getStatus(e);
        const unauthorized = status === 401 || status === 403;

        // Expected when token is missing/expired/invalid:
        // clear `me` and (optionally) clear token so we don't keep re-trying
        setMe(null);

        if (unauthorized) {
          // Clear token + storage to stop noisy retries and "bad response" logs.
          persistToken("");
          setToken("");
        }
      } finally {
        if (!cancelled && reqId === meReqId.current) setLoadingMe(false);
      }
    })();

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
      isAuthed: hydrated && token.length > 0,

      loginWithToken: (t: string) => {
        const next = normalizeToken(t);
        setMe(null);

        // Persist immediately so it’s written before any navigation
        persistToken(next);
        setToken(next);
      },

      logout: () => {
        setMe(null);
        persistToken("");
        setToken("");
      },
    }),
    [token, me, loadingMe, hydrated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}