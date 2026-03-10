// frontend_next/app/robots.txt/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function siteUrl(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");

  // Dev fallback: derive from request (works on localhost)
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function GET(req: NextRequest) {
  const base = siteUrl(req);

  const lines = [
    // Let Googlebot load API resources for rendering (URL Inspection / Live Test).
    // This does NOT mean Google will index /api/ (it’s just fetch permission).
    "User-agent: Googlebot",
    "Allow: /api/",
    "Allow: /",
    "",

    // Default rule set for everyone else
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /api/",
    "Disallow: /account/",
    "Disallow: /collection/",
    "Disallow: /sign-in",
    "Disallow: /sign-up",
    "Disallow: /me",
    "",
    `Sitemap: ${base}/sitemap_index.xml`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}