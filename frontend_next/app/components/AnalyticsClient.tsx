"use client";

import React, { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type AnalyticsClientProps = {
  title?: string;
};

function AnalyticsInner({ title }: AnalyticsClientProps) {
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    // Put your existing analytics logic here.
    // If you were setting a title for GA page_view, use `title` when provided.
    // Example (only if you already have gtag wired up):
    // window.gtag?.("event", "page_view", { page_path: pathname, page_title: title ?? document.title });

    void pathname;
    void sp;
    void title;
  }, [pathname, sp, title]);

  return null;
}

export default function AnalyticsClient(props: AnalyticsClientProps) {
  return (
    <Suspense fallback={null}>
      <AnalyticsInner {...props} />
    </Suspense>
  );
}