// frontend_next/app/themes/top/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { themeToSlug } from "@/lib/slug";
import { siteBase, SITE_NAME } from "@/lib/url";


export const dynamic = "force-static";
export const revalidate = 3600;

// Keep in sync with sitemap.xml/route.ts and /themes/[themeSlug]/top/page.tsx
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

const TITLE = `Top LEGO sets by theme | ${SITE_NAME}`;
const DESCRIPTION = "Browse the highest-rated LEGO sets in our curated top LEGO themes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/themes/top" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/themes/top",
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

function ThemeCard({ theme }: { theme: string }) {
  const slug = themeToSlug(theme);
  return (
    <Link
      href={`/themes/${slug}/top`}
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300 hover:bg-zinc-100"
    >
      <div className="text-sm font-semibold text-zinc-900">{theme}</div>
      <div className="mt-1 text-sm text-zinc-500">View top sets →</div>
    </Link>
  );
}

export default function TopThemesHubPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Themes", href: "/themes" },
            { label: "Top themes" },
          ]}
        />

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold">Top themes</h1>
            <p className="mt-2 max-w-[720px] text-sm text-zinc-500">
              Curated pages: highest-rated sets in the most popular themes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/new"
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              New releases →
            </Link>
            <Link
              href="/pieces/under/500/best"
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              Best under 500 pcs →
            </Link>
            <Link
              href="/years"
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              Browse by year →
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOP_THEMES.map((t) => (
          <ThemeCard key={t} theme={t} />
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
        <div className="font-semibold text-zinc-900">Want more?</div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/themes" className="font-semibold hover:underline">
            Browse all themes →
          </Link>
          <Link href="/themes" className="font-semibold hover:underline">
            Explore theme pages →
          </Link>
          <Link href="/" className="font-semibold hover:underline">
            Back to home →
          </Link>
        </div>
      </div>
    </div>
  );
}