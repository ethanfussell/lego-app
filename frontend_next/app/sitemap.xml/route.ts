// frontend_next/app/sitemap.xml/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function siteUrl(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function apiBase() {
  // Use your backend directly for sitemap generation
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
}

function isoDate(d = new Date()) {
  return d.toISOString();
}

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

type ThemeItem = { name?: string; theme?: string };

function isThemeItem(x: unknown): x is ThemeItem {
  return typeof x === "object" && x !== null;
}

function toThemeItemArray(data: unknown): ThemeItem[] {
  if (Array.isArray(data)) return data.filter(isThemeItem);
  if (typeof data === "object" && data !== null) {
    const results = (data as { results?: unknown }).results;
    return Array.isArray(results) ? results.filter(isThemeItem) : [];
  }
  return [];
}

async function fetchThemes(): Promise<string[]> {
  try {
    const res = await fetch(`${apiBase()}/themes`, { cache: "no-store" });
    if (!res.ok) return [];
    const data: unknown = await res.json();

    const arr = toThemeItemArray(data);
    return arr
      .map((t) => String(t.theme ?? t.name ?? "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function urlEntry(loc: string, lastmod?: string, changefreq?: string, priority?: number) {
  return [
    "<url>",
    `<loc>${esc(loc)}</loc>`,
    lastmod ? `<lastmod>${esc(lastmod)}</lastmod>` : "",
    changefreq ? `<changefreq>${esc(changefreq)}</changefreq>` : "",
    typeof priority === "number" ? `<priority>${priority.toFixed(1)}</priority>` : "",
    "</url>",
  ]
    .filter(Boolean)
    .join("");
}

export async function GET(req: NextRequest) {
  const base = siteUrl(req);
  const now = isoDate();

  // Static pages you want indexed (adjust as needed)
  const staticPaths = [
    "/", // home
    "/search", // if you have it
    "/login",
    "/signup",
    "/lists", // if exists
    "/me", // if exists
  ];

  const themes = await fetchThemes();

  const urls: string[] = [];

  for (const p of staticPaths) {
    urls.push(urlEntry(`${base}${p}`, now, "daily", p === "/" ? 1.0 : 0.6));
  }

  for (const t of themes) {
    urls.push(urlEntry(`${base}/themes/${encodeURIComponent(t)}`, now, "weekly", 0.5));
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.join("") +
    `</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}