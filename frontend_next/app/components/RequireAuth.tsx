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
    return <div className="p-6 text-sm text-zinc-500">Loading...</div>;
  }

  if (!isAuthed) {
    return <RedirectToSignIn />;
  }

  return <>{children}</>;
}
