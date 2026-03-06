// frontend_next/app/components/WebVitals.tsx
"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Reports Core Web Vitals (LCP, CLS, INP, FCP, TTFB) to GA4.
 * Rendered once in the root layout.
 */
export default function WebVitals() {
  useReportWebVitals((metric) => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;

    window.gtag("event", metric.name, {
      // Use the metric value as reported
      value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      event_category: "Web Vitals",
      event_label: metric.id,
      non_interaction: true,
    });
  });

  return null;
}
