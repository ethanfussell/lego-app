"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { pageview } from "@/lib/ga";

export default function GA4RouteTracker() {
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    const search = sp?.toString() || "";
    const url = search ? `${pathname}?${search}` : pathname;

    pageview(url);
  }, [pathname, sp]);

  return null;
}