"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/lib/ga";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

/**
 * Fires a GA4 page_view when route changes.
 * This is the "App Router way" (since Next doesn't do automatic history tracking for GA4).
 */
export default function GA4PageView() {
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    if (!GA_ID) return;
    const qs = sp?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    pageview(window.location.origin + url);
  }, [pathname, sp]);

  return null;
}