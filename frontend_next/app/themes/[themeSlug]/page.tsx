// frontend_next/app/themes/[themeSlug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import ThemeDetailClient from "./ThemeDetailClient";

type SP = Record<string, string | string[] | undefined>;

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

type PromiseLikeValue<T> = { then: (onFulfilled: (value: T) => unknown) => unknown };

function isPromiseLike<T>(v: unknown): v is PromiseLikeValue<T> {
  return typeof v === "object" && v !== null && "then" in v && typeof (v as { then?: unknown }).then === "function";
}

async function unwrap<T>(p: T | Promise<T>): Promise<T> {
  return isPromiseLike<T>(p) ? await (p as Promise<T>) : (p as T);
}

function first(sp: SP, key: string): string {
  const raw = sp[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v ?? "").trim();
}

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeTheme(t: string) {
  return decodeURIComponent(t).trim();
}

// Returns true if the theme has at least 1 set.
// (MVP assumption: real themes always have sets; empty => invalid theme slug)
const themeHasAnySets = cache(async (themeSlug: string): Promise<boolean> => {
  const theme = normalizeTheme(themeSlug);
  if (!theme) return false;

  const url = `${apiBase()}/themes/${encodeURIComponent(theme)}/sets?limit=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return false;

  const data: unknown = await res.json();
  return Array.isArray(data) && data.length > 0;
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
  searchParams?: SP | Promise<SP>;
}): Promise<Metadata> {
  const { themeSlug } = await unwrap(params);
  const sp = searchParams ? await unwrap(searchParams) : ({} as SP);

  // If invalid theme, we want a real 404 and no indexing
  const ok = await themeHasAnySets(themeSlug);
  if (!ok) {
    return {
      title: "Page not found",
      robots: { index: false, follow: false },
      metadataBase: new URL(siteBase()),
    };
  }

  const theme = normalizeTheme(themeSlug);
  const page = toInt(first(sp, "page") || "1", 1);

  const canonical = `/themes/${encodeURIComponent(themeSlug)}` + (page > 1 ? `?page=${page}` : "");
  const title = `${theme} sets`;
  const description =
    page > 1 ? `Browse LEGO sets in the ${theme} theme. Page ${page}.` : `Browse LEGO sets in the ${theme} theme.`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function ThemeSetsPage({
  params,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
}) {
  const { themeSlug } = await unwrap(params);

  const ok = await themeHasAnySets(themeSlug);
  if (!ok) notFound();

  return <ThemeDetailClient themeSlug={themeSlug} />;
}