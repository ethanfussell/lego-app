// frontend_next/app/robots.txt/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function siteUrl(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function GET(req: NextRequest) {
  const base = siteUrl(req);

  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    // Crawl hygiene (noindex still handled by metadata)
    "Disallow: /account",
    "Disallow: /login",
    "Disallow: /signup",
    "Disallow: /collection",
    "Disallow: /me",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}