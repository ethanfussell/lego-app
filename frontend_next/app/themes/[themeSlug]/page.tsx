// frontend_next/app/themes/[themeSlug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import ThemeDetailClient from "./ThemeDetailClient";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { slugToTheme } from "@/lib/slug";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export const revalidate = 3600; // 1 hour (page shell can be cached)

export async function generateMetadata({
  params,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
}): Promise<Metadata> {
  const { themeSlug } = await params;
  const themeName = slugToTheme(themeSlug);

  const title = `${themeName} sets`;
  const description = `Browse LEGO sets in the ${themeName} theme.`;
  const canonical = `/themes/${themeSlug}`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${title} | ${SITE_NAME}`,
      description,
    },
  };
}

export default async function ThemeSetsPage({
  params,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
}) {
  const { themeSlug } = await params;
  const themeName = slugToTheme(themeSlug);

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Themes", href: "/themes" },
            { label: themeName },
          ]}
        />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/themes" className="inline-block text-sm font-semibold hover:underline">
            ← Back to themes
          </Link>
          <Link href="/years" className="inline-block text-sm font-semibold hover:underline">
            Browse by year →
          </Link>
        </div>
      </div>

      {/* Client handles fetching/pagination/sort so this route can be cached */}
      <ThemeDetailClient themeSlug={themeSlug} initialSets={[]} />
    </>
  );
}