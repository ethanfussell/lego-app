// frontend_next/app/search/page.tsx
import type { Metadata } from "next";
import SearchClient from "./SearchClient";

type SP = Record<string, string | string[] | undefined>;

const SITE_NAME = "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

// Handles Next versions where searchParams may be Promise or plain object
async function unwrapSearchParams<T extends object>(p?: T | Promise<T>): Promise<T> {
  if (!p) return {} as T;
  return typeof (p as any)?.then === "function" ? await (p as any) : (p as T);
}

function first(sp: SP, key: keyof SP): string {
  const raw = sp[key as string];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v || "").toString().trim();
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SP> | SP;
}): Promise<Metadata> {
  const sp = await unwrapSearchParams(searchParams);

  const q = first(sp, "q");

  const title = q ? `Search “${q}” | ${SITE_NAME}` : `Search | ${SITE_NAME}`;
  const description = q
    ? `Search results for “${q}”.`
    : "Search LEGO sets by name, theme, year, and more.";

  const canonicalPath = "/search"; // ✅ fixed canonical (no query params)

  return {
    title,
    description,

    // Ensures canonical & OG URLs resolve to absolute URLs
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },

    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
    },

    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SP> | SP;
}) {
  const sp = await unwrapSearchParams(searchParams);

  const q = first(sp, "q");
  const sort = first(sp, "sort") || "relevance";

  const pageNum = Number(first(sp, "page") || "1");
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return <SearchClient initialQ={q} initialSort={sort} initialPage={page} />;
}