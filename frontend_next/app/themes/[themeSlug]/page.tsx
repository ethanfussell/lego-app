// frontend_next/app/themes/[themeSlug]/page.tsx
import type { Metadata } from "next";
import ThemeDetailClient from "./ThemeDetailClient";

function prettyFromSlug(themeSlug: string) {
  const raw = decodeURIComponent(themeSlug || "Theme");
  if (raw.includes(" ")) return raw;
  return raw.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export async function generateMetadata({
  params,
}: {
  params: { themeSlug: string };
}): Promise<Metadata> {
  const themeName = prettyFromSlug(params.themeSlug);

  return {
    title: `${themeName} LEGO sets | YourSite`,
    description: `Browse LEGO sets in the ${themeName} theme. Sort and paginate to find sets fast.`,
  };
}

export default function Page({ params }: { params: { themeSlug: string } }) {
  return <ThemeDetailClient themeSlug={params.themeSlug} />;
}