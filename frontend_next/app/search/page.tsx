// frontend_next/app/search/page.tsx
import type { Metadata } from "next";
import SearchClient from "./SearchClient";
import { siteBase } from "@/lib/url";
import { unwrapSearchParams, first, type SP } from "@/lib/searchParams";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SP> | SP;
}): Promise<Metadata> {
  const sp = await unwrapSearchParams(searchParams);
  const q = first(sp, "q");

  const title = q ? `Search “${q}”` : `Search`;
  const description = q ? `Search results for “${q}”.` : "Search LEGO sets by name, theme, year, and more.";
  const canonicalPath = "/search";

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  const sp = await unwrapSearchParams(searchParams);

  const q = first(sp, "q");
  const sort = first(sp, "sort") || "relevance";
  const order = first(sp, "order") || "";

  const pageNum = Number(first(sp, "page") || "1");
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return <SearchClient initialQ={q} initialSort={sort} initialOrder={order} initialPage={page} />;
}