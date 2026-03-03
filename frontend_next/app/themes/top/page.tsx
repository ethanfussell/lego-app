// frontend_next/app/themes/top/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { themeToSlug } from "@/lib/slug";

export const dynamic = "force-static";
export const revalidate = 3600;

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

// Keep in sync with sitemap.xml/route.ts and [themeSlug]/top/page.tsx
const TOP_THEMES = [
  "Star Wars",
  "Duplo",
  "City",
  "Town",
  "Friends",
  "Educational and Dacta",
  "Creator",
  "Technic",
  "Ninjago",
  "Seasonal",
] as const;

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function generateMetadata(): Promise<Metadata> {
  const title = `Top LEGO sets by theme | ${SITE_NAME}`;
  const description = "Browse the highest-rated LEGO sets in our curated top LEGO themes.";
  const canonicalPath = "/themes/top";

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default function TopThemesHubPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Themes", href: "/themes" }, { label: "Top themes" }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Top themes</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Curated pages: highest-rated sets in the most popular themes.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/themes" className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
            Browse all themes →
          </Link>
          <Link href="/years" className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
            Browse by year →
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOP_THEMES.map((t) => {
          const slug = themeToSlug(t);
          return (
            <Link
              key={t}
              href={`/themes/${slug}/top`}
              className="rounded-xl border border-black/[.08] bg-white p-4 hover:bg-zinc-50 dark:border-white/[.145] dark:bg-black dark:hover:bg-zinc-900"
            >
              <div className="font-semibold">{t}</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">View top sets →</div>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/themes"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
        >
          ← All themes
        </Link>
        <Link
          href="/"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
        >
          ← Home
        </Link>
      </div>
    </div>
  );
}