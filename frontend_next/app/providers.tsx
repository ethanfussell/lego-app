// frontend_next/app/providers.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  useAuth as useClerkAuth,
  useUser as useClerkUser,
  useClerk,
} from "@clerk/nextjs";

// ---------- Types ----------

type Me = {
  id: number | string;
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

// ---------- Context ----------

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthBridge — thin compatibility wrapper around Clerk hooks.
 *
 * Exposes the same `useAuth()` shape that all 30+ components already use:
 *   { token, me, loadingMe, hydrated, isAuthed, loginWithToken, logout }
 *
 * - `token`: Clerk session JWT (fetched via getToken())
 * - `me`: derived from Clerk's useUser()
 * - `isAuthed`: from Clerk's isSignedIn
 * - `hydrated`: from Clerk's isLoaded
 * - `loginWithToken`: no-op (Clerk handles sign-in via its own UI)
 * - `logout`: calls Clerk signOut()
 */
export function AuthBridge({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { user } = useClerkUser();
  const clerk = useClerk();

  // Session token state — refreshed from Clerk on mount, sign-in, and periodically.
  // Clerk JWTs are short-lived (~60s), so we refresh every 45s to stay ahead.
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      requestAnimationFrame(() => setToken(""));
      return;
    }

    let cancelled = false;

    async function refresh() {
      try {
        const t = await getToken();
        if (!cancelled) setToken(t || "");
      } catch {
        if (!cancelled) setToken("");
      }
    }

    // Fetch immediately
    refresh();

    // Refresh every 45 seconds to keep token fresh
    const interval = setInterval(refresh, 45_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isLoaded, isSignedIn, getToken]);

  // Derive `me` from Clerk user
  const me = useMemo<Me | null>(() => {
    if (!isLoaded || !isSignedIn || !user) return null;

    return {
      id: user.id,
      username:
        user.username ||
        user.firstName ||
        user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
        "user",
    };
  }, [isLoaded, isSignedIn, user]);

  // loginWithToken is a no-op — Clerk manages sign-in
  const loginWithToken = useCallback((_t: string) => {
    // no-op: Clerk handles sign-in via its own UI / redirect
  }, []);

  const logout = useCallback(() => {
    setToken("");
    clerk.signOut({ redirectUrl: "/" });
  }, [clerk]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      me,
      loadingMe: !isLoaded,
      hydrated: isLoaded ?? false,
      isAuthed: !!(isLoaded && isSignedIn),
      loginWithToken,
      logout,
    }),
    [token, me, isLoaded, isSignedIn, loginWithToken, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Drop-in replacement hook — same API surface as before.
 * All existing components keep calling useAuth() unchanged.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthBridge> (or <ClerkProvider>)");
  return ctx;
}
