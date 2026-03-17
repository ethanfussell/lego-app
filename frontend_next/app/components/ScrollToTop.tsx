// frontend_next/app/components/ScrollToTop.tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Scrolls to the top of the page whenever the pathname changes.
 * Hash-based scrolling (e.g. #shop) is handled by individual pages.
 */
export default function ScrollToTop() {
  const pathname = usePathname();
  const prev = useRef(pathname);

  useEffect(() => {
    if (pathname !== prev.current) {
      window.scrollTo(0, 0);
      prev.current = pathname;
    }
  }, [pathname]);

  return null;
}
