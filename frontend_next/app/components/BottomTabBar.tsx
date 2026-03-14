// frontend_next/app/components/BottomTabBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const tabs = [
  {
    href: "/",
    label: "Home",
    match: (p: string) => p === "/",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/discover",
    label: "Discover",
    match: (p: string) => p.startsWith("/discover") || p.startsWith("/search") || p.startsWith("/themes"),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: "/collection",
    label: "Collection",
    match: (p: string) => p.startsWith("/collection"),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  // Feed tab disabled (social features deferred)
  // {
  //   href: "/feed",
  //   label: "Feed",
  //   match: (p: string) => p.startsWith("/feed"),
  //   icon: ( ... ),
  // },
  {
    href: "/account",
    label: "Profile",
    match: (p: string) => p.startsWith("/account"),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function BottomTabBar() {
  const pathname = usePathname() || "/";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[998] sm:hidden border-t border-zinc-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Mobile navigation">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors",
                active ? "text-amber-600" : "text-zinc-500"
              )}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
