"use client";

import React from "react";
import { RedirectToSignIn } from "@clerk/nextjs";
import { useAuth } from "@/app/providers";

/**
 * Auth gate — renders children only when signed in.
 * Redirects to Clerk sign-in otherwise.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthed, hydrated } = useAuth();

  if (!hydrated) {
    return <div className="p-6 animate-pulse space-y-3"><div className="h-4 w-32 rounded bg-zinc-200" /><div className="h-3 w-24 rounded bg-zinc-100" /></div>;
  }

  if (!isAuthed) {
    return <RedirectToSignIn />;
  }

  return <>{children}</>;
}
