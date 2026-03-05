import { NextResponse } from "next/server";
import { siteBase } from "@/lib/url";


export const runtime = "nodejs";

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