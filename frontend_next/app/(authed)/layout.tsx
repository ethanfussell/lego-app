// frontend_next/app/(authed)/layout.tsx
"use client";

import React from "react";
import { redirect, usePathname } from "next/navigation";
import { useAuth } from "@/app/providers";

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const { token, hydrated } = useAuth();
  const pathname = usePathname();

  // avoid flashing authed UI before we know auth state
  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="text-sm text-zinc-500">Loading…</div>
      </div>
    );
  }

  // if not logged in, go to login (optionally preserve returnTo)
  if (!token) {
    // If you want returnTo behavior, do it on the login page via searchParams.
    // Here we keep it simple:
    redirect(`/login?returnTo=${encodeURIComponent(pathname || "/")}`);
  }

  return <>{children}</>;
}