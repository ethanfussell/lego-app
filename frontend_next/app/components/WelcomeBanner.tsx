// frontend_next/app/components/WelcomeBanner.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "bricktrack_welcome_dismissed";

const quickLinks = [
  {
    href: "/search",
    label: "Search for sets",
    description: "Find sets you own or want",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
      </svg>
    ),
  },
  {
    href: "/themes",
    label: "Browse themes",
    description: "Star Wars, City, Technic & more",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
  {
    href: "/collection",
    label: "Start your collection",
    description: "Track what you own & want",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    href: "/discover",
    label: "Explore popular sets",
    description: "See what others are collecting",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18z" />
      </svg>
    ),
  },
];

export default function WelcomeBanner({ username }: { username?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "true") {
        setVisible(true);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  }

  if (!visible) return null;

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
      {/* Dismiss button */}
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <h2 className="text-xl font-bold text-zinc-900">
        Welcome to BrickTrack{username ? `, ${username}` : ""}! 🧱
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Here are a few things you can do to get started:
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={dismiss}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-amber-300 hover:bg-amber-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              {link.icon}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900">{link.label}</div>
              <div className="text-xs text-zinc-500">{link.description}</div>
            </div>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="mt-4 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
      >
        Got it, don&apos;t show again
      </button>
    </div>
  );
}
