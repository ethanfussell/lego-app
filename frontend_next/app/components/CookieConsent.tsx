// frontend_next/app/components/CookieConsent.tsx
"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "bricktrack_cookie_consent";

type Consent = "accepted" | "declined" | null;

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "accepted" || v === "declined") return v;
    return null;
  } catch {
    return null;
  }
}

function writeConsent(value: "accepted" | "declined") {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

/**
 * Disable GA4 tracking by setting the `window['ga-disable-MEASUREMENT_ID']`
 * property, which is the official way to opt-out of gtag.js.
 */
function disableGA4() {
  const gaId = process.env.NEXT_PUBLIC_GA4_ID;
  if (!gaId) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)[`ga-disable-${gaId}`] = true;
  } catch {
    // ignore
  }
}

function enableGA4() {
  const gaId = process.env.NEXT_PUBLIC_GA4_ID;
  if (!gaId) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)[`ga-disable-${gaId}`] = false;
  } catch {
    // ignore
  }
}

export default function CookieConsent() {
  const [consent, setConsent] = useState<Consent>("accepted"); // default to hide banner during SSR
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    // Use requestAnimationFrame to avoid synchronous setState in effect
    requestAnimationFrame(() => {
      setConsent(stored);
      setMounted(true);
    });

    // If previously declined, disable GA4
    if (stored === "declined") {
      disableGA4();
    }
  }, []);

  function accept() {
    writeConsent("accepted");
    setConsent("accepted");
    enableGA4();
  }

  function decline() {
    writeConsent("declined");
    setConsent("declined");
    disableGA4();
  }

  // Don't show until mounted (avoids hydration mismatch)
  if (!mounted) return null;

  // Already made a choice
  if (consent !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-600">
            We use cookies for analytics and to improve your experience. You
            can accept or decline.
          </p>
        </div>

        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={decline}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
