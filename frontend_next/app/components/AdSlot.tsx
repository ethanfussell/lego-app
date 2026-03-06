// frontend_next/app/components/AdSlot.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  slot: string;
  format?: "horizontal" | "rectangle";
  className?: string;
};

/**
 * Ad slot placeholder.
 *
 * - In development: shows a subtle dashed placeholder with the slot name.
 * - In production without NEXT_PUBLIC_AD_PROVIDER: hidden entirely.
 * - In production with NEXT_PUBLIC_AD_PROVIDER: renders the ad network tag
 *   (lazy-loaded via Intersection Observer).
 */
export default function AdSlot({ slot, format = "horizontal", className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  const adProvider = process.env.NEXT_PUBLIC_AD_PROVIDER || "";
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

  // Dev mode: dashed placeholder
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

  // Production with provider: render ad tag when visible
  return (
    <div
      ref={ref}
      className={`${heightClass} ${className}`}
      data-ad-slot={slot}
      data-ad-format={format}
    >
      {visible ? (
        <div className="flex items-center justify-center text-xs text-zinc-400">
          {/* Ad network script/tag goes here when provider is configured */}
        </div>
      ) : null}
    </div>
  );
}
