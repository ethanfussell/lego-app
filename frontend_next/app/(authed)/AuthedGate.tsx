// frontend_next/app/(authed)/AuthedGate.tsx
"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";

export default function AuthedGate({ children }: { children: React.ReactNode }) {
  const { token, hydrated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // After hydration, if not authed, redirect client-side
  useEffect(() => {
    if (!hydrated) return;
    if (token) return;

    const returnTo = pathname || "/";
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [hydrated, token, pathname, router]);

  // avoid flashing authed UI before we know auth state
  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="text-sm text-zinc-500">Loading…</div>
      </div>
    );
  }

  // while redirecting
  if (!token) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="text-sm text-zinc-500">Redirecting…</div>
      </div>
    );
  }

  return <>{children}</>;
}