// frontend_next/app/themes/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

const SITE_NAME = "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export const metadata: Metadata = {
  title: `Themes | ${SITE_NAME}`,
  description: `Browse LEGO themes on ${SITE_NAME}.`,
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/themes" },
  openGraph: {
    title: `Themes | ${SITE_NAME}`,
    description: `Browse LEGO themes on ${SITE_NAME}.`,
    url: "/themes",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Themes | ${SITE_NAME}`,
    description: `Browse LEGO themes on ${SITE_NAME}.`,
  },
};

// Curated starter list (edit any time)
const THEMES = [
  "Star Wars",
  "Technic",
  "City",
  "Creator",
  "Creator Expert",
  "Ideas",
  "Harry Potter",
  "Marvel",
  "DC",
  "Architecture",
  "NINJAGO",
  "Friends",
  "Minecraft",
  "Disney",
  "Speed Champions",
  "Icons",
];

export default function ThemesIndexPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-bold">Themes</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Pick a theme to browse sets. (We’ll wire a full themes directory once the API
        exposes a themes list endpoint.)
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((t) => {
          const href = `/themes/${encodeURIComponent(t)}`;
          return (
            <Link
              key={t}
              href={href}
              className="rounded-xl border border-black/[.08] bg-white p-4 hover:bg-zinc-50 dark:border-white/[.145] dark:bg-black dark:hover:bg-zinc-900"
            >
              <div className="font-semibold">{t}</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">View sets →</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}