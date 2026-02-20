import { NextResponse } from "next/server";

export const runtime = "nodejs";

function siteBase(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NODE_ENV === "production" && !env) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be set in production");
  }
  return (env || "http://localhost:3000").replace(/\/+$/, "");
}

export async function GET() {
  const base = siteBase();
  const now = new Date().toISOString();

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <sitemap>\n` +
    `    <loc>${base}/sitemap.xml</loc>\n` +
    `    <lastmod>${now}</lastmod>\n` +
    `  </sitemap>\n` +
    `</sitemapindex>\n`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0",
    },
  });
}