"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, loadingMe, hydrated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hydrated) return;
    if (!loadingMe && !token) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
    }
  }, [hydrated, loadingMe, token, router, pathname]);

  if (!hydrated) return <div style={{ padding: "1.5rem" }}>Checking session…</div>;
  if (loadingMe) return <div style={{ padding: "1.5rem" }}>Checking session…</div>;
  if (!token) return null; // while redirecting

  return <>{children}</>;
}