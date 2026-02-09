// frontend_next/app/sitemap.xml/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function siteUrl(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function apiBase(): string {
  // Sitemap should NEVER fall back to localhost.
  // Require an env var in production deployments.
  const base = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    throw new Error("Missing API_BASE_URL / NEXT_PUBLIC_API_BASE_URL for sitemap generation.");
  }
  return base.replace(/\/+$/, "");
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

function toThemeItems(x: unknown): ThemeItem[] {
  if (Array.isArray(x)) return x.filter(isThemeItem);
  if (typeof x === "object" && x !== null) {
    const results = (x as { results?: unknown }).results;
    return Array.isArray(results) ? results.filter(isThemeItem) : [];
  }
  return [];
}

async function fetchThemes(): Promise<string[]> {
  try {
    const res = await fetch(`${apiBase()}/themes`, {
      // If your backend is stable, you can change to:
      // next: { revalidate: 3600 }
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();

    return toThemeItems(data)
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

  // ONLY indexable static routes here
  const staticPaths: Array<{ path: string; changefreq: string; priority: number }> = [
    { path: "/", changefreq: "daily", priority: 1.0 },

    // Hubs / discovery
    { path: "/themes", changefreq: "daily", priority: 0.8 },
    { path: "/lists/public", changefreq: "daily", priority: 0.7 },

    // Browse feeds (if you want them indexed)
    { path: "/sale", changefreq: "daily", priority: 0.6 },
    { path: "/retiring-soon", changefreq: "daily", priority: 0.6 },
    { path: "/new", changefreq: "daily", priority: 0.5 },

    // Legal (fine to index)
    { path: "/privacy", changefreq: "yearly", priority: 0.2 },
    { path: "/terms", changefreq: "yearly", priority: 0.2 },
    { path: "/affiliate-disclosure", changefreq: "yearly", priority: 0.2 },
  ];

  const themes = await fetchThemes();

  const urls: string[] = [];

  for (const p of staticPaths) {
    urls.push(urlEntry(`${base}${p.path}`, now, p.changefreq, p.priority));
  }

  // Theme pages
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