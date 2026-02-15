// frontend_next/app/years/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/app/components/Breadcrumbs";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function yearBounds() {
  return { min: 1980, max: new Date().getFullYear() };
}

export const metadata: Metadata = {
  title: "Browse by year",
  description: `Browse LEGO sets by release year on ${SITE_NAME}.`,
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/years" },
  openGraph: {
    title: `Browse by year | ${SITE_NAME}`,
    description: `Browse LEGO sets by release year on ${SITE_NAME}.`,
    url: "/years",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Browse by year | ${SITE_NAME}`,
    description: `Browse LEGO sets by release year on ${SITE_NAME}.`,
  },
};

export default function YearsPage() {
  const { min, max } = yearBounds();

  // newest -> oldest
  const years: number[] = [];
  for (let y = max; y >= min; y--) years.push(y);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Years" }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Browse by year</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Pick a year from {min} to {max}.
          </p>

          {/* Task 8: internal links (SEO) */}
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/themes" className="text-zinc-900 hover:underline dark:text-zinc-50">
              Browse themes →
            </Link>
            <Link href={`/years/${max}`} className="text-zinc-900 hover:underline dark:text-zinc-50">
              Newest year →
            </Link>
          </div>
        </div>

        <Link href="/" className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
          ← Home
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {years.map((y) => (
          <Link
            key={y}
            href={`/years/${y}`}
            className="grid h-11 place-items-center rounded-xl border border-black/[.08] bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/[.14] dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            {y}
          </Link>
        ))}
      </div>
    </div>
  );
}