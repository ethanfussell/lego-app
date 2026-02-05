// frontend_next/app/components/AnalyticsClient.tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { pageview } from "@/lib/ga";

export default function AnalyticsClient({ title }: { title?: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  // ✅ stable deps (string), not the sp object
  const search = useMemo(() => sp?.toString() || "", [sp]);
  const url = useMemo(() => (search ? `${pathname}?${search}` : pathname), [pathname, search]);

  useEffect(() => {
    if (!pathname) return;
    // ✅ pass title so we don't rely on document.title being ready
    pageview(url);
  }, [pathname, url, title]);

  return null;
}