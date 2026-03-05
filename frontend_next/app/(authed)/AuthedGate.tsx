// frontend_next/app/(authed)/AuthedGate.tsx
"use client";

import React from "react";
import { RedirectToSignIn } from "@clerk/nextjs";
import { useAuth } from "@/app/providers";

/**
 * Auth gate for the (authed) route group.
 * Renders children only when signed in, redirects to Clerk sign-in otherwise.
 */
export default function AuthedGate({ children }: { children: React.ReactNode }) {
  const { isAuthed, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthed) {
    return <RedirectToSignIn />;
  }

  return <>{children}</>;
}
