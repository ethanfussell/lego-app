// frontend_next/app/components/AdSlot.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Props = {
  slot: string;
  format?: "horizontal" | "rectangle";
  className?: string;
};

/**
 * Mapping of slot names to AdSense ad unit IDs.
 * Update these values with your actual ad unit IDs from the AdSense dashboard.
 */
const ADSENSE_SLOTS: Record<string, string> = {
  home_mid: "",
  set_detail_mid: "",
  search_after_results: "",
  new_mid: "",
  sale_mid: "",
  retiring_mid: "",
  themes_bottom: "",
  theme_detail_mid: "",
  shop_mid: "",
};

/**
 * Inner component that renders the actual AdSense <ins> tag.
 * Separated so it can be keyed on pathname to get fresh elements on navigation.
 */
function AdSenseUnit({
  slot,
  format,
  pubId,
}: {
  slot: string;
  format: "horizontal" | "rectangle";
  pubId: string;
}) {
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!insRef.current || pushed.current) return;
    pushed.current = true;

    try {
      // Check cookie consent — serve non-personalized ads if declined
      const consent = localStorage.getItem("bricktrack_cookie_consent");
      if (consent === "declined") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).adsbygoogle = (window as any).adsbygoogle || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).adsbygoogle.requestNonPersonalizedAds = 1;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded or blocked by adblocker — fail silently
    }
  }, []);

  const unitId = ADSENSE_SLOTS[slot] || "";

  if (format === "rectangle") {
    return (
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "inline-block", width: "300px", height: "250px" }}
        data-ad-client={pubId}
        data-ad-slot={unitId || undefined}
      />
    );
  }

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={pubId}
      data-ad-slot={unitId || undefined}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

/**
 * Ad slot component.
 *
 * - In development (no provider): shows a subtle dashed placeholder with the slot name.
 * - In production without NEXT_PUBLIC_AD_PROVIDER: hidden entirely.
 * - In production with NEXT_PUBLIC_AD_PROVIDER=adsense: renders the AdSense ad tag
 *   (lazy-loaded via Intersection Observer).
 */
export default function AdSlot({ slot, format = "horizontal", className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  const adProvider = process.env.NEXT_PUBLIC_AD_PROVIDER || "";
  const pubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID || "";
  const isDev = process.env.NODE_ENV !== "production";

  // Lazy-load via Intersection Observer
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Production mode without an ad provider → hidden
  if (!isDev && !adProvider) return null;

  const heightClass = format === "rectangle" ? "min-h-[250px]" : "min-h-[90px]";

  // Dev mode without provider: dashed placeholder
  if (isDev && !adProvider) {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-400 ${heightClass} ${className}`}
        data-ad-slot={slot}
      >
        Ad: {slot} ({format})
      </div>
    );
  }

  // Production (or dev) with provider: render ad tag when visible
  return (
    <div
      ref={ref}
      className={`overflow-hidden ${heightClass} ${className}`}
      data-ad-slot={slot}
      data-ad-format={format}
    >
      {visible && adProvider === "adsense" && pubId ? (
        <AdSenseUnit
          key={`${slot}-${pathname}`}
          slot={slot}
          format={format}
          pubId={pubId}
        />
      ) : null}
    </div>
  );
}
