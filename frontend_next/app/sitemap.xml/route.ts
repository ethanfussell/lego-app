import { NextResponse } from "next/server";

export const runtime = "nodejs";

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
}

/**
 * ✅ Adjust these if your backend paths differ.
 * - SETS_INDEX: should return {results:[{set_num:string}]} or an array
 * - THEMES_INDEX: should return {results:[{name:string}|string]} or an array
 * - PUBLIC_LISTS_INDEX: should return {results:[{id:string|number}]} or an array
 */
const SETS_INDEX = "/sets";
const THEMES_INDEX = "/themes";
const PUBLIC_LISTS_INDEX = "/lists/public";

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickResultsArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.results)) return data.results as unknown[];
  return [];
}

async function fetchJsonWithCount(url: string): Promise<{ data: unknown; totalCount: number | null }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { data: null, totalCount: null };

  const header = res.headers.get("x-total-count") || res.headers.get("X-Total-Count");
  const parsed = header ? Number(header) : NaN;
  const totalCount = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

  const data: unknown = await res.json().catch(() => null);
  return { data, totalCount };
}

function xmlEscape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

type UrlEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

function toSitemapXml(entries: UrlEntry[]) {
  const body = entries
    .map((e) => {
      return [
        "<url>",
        `  <loc>${xmlEscape(e.loc)}</loc>`,
        e.lastmod ? `  <lastmod>${xmlEscape(e.lastmod)}</lastmod>` : null,
        e.changefreq ? `  <changefreq>${e.changefreq}</changefreq>` : null,
        typeof e.priority === "number" ? `  <priority>${e.priority.toFixed(1)}</priority>` : null,
        "</url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`;
}

async function collectSetUrls(): Promise<string[]> {
  const limit = 500; // keep reasonable; backend should support this
  const firstUrl = `${apiBase()}${SETS_INDEX}?limit=${limit}&page=1`;

  const first = await fetchJsonWithCount(firstUrl);
  const firstRows = pickResultsArray(first.data);

  // extract set_num
  const setNums: string[] = [];
  for (const r of firstRows) {
    if (isRecord(r) && typeof r.set_num === "string" && r.set_num.trim()) setNums.push(r.set_num.trim());
  }

  const totalPages =
    first.totalCount != null ? Math.max(1, Math.ceil(first.totalCount / limit)) : 1;

  // fetch remaining pages if we know totalPages (or if page 1 looked full)
  const pagesToFetch =
    totalPages > 1 ? totalPages : firstRows.length === limit ? 5 : 1; // fallback: try a few pages

  for (let page = 2; page <= pagesToFetch; page++) {
    const url = `${apiBase()}${SETS_INDEX}?limit=${limit}&page=${page}`;
    const { data } = await fetchJsonWithCount(url);
    const rows = pickResultsArray(data);

    let added = 0;
    for (const r of rows) {
      if (isRecord(r) && typeof r.set_num === "string" && r.set_num.trim()) {
        setNums.push(r.set_num.trim());
        added++;
      }
    }

    // if fallback mode and a page returns empty, stop
    if (totalPages === 1 && added === 0) break;
  }

  // unique
  return Array.from(new Set(setNums)).map((sn) => `/sets/${encodeURIComponent(sn)}`);
}

async function collectThemeUrls(): Promise<string[]> {
  const limit = 500;
  const firstUrl = `${apiBase()}${THEMES_INDEX}?limit=${limit}&page=1`;

  const first = await fetchJsonWithCount(firstUrl);
  const rows = pickResultsArray(first.data);

  const themes: string[] = [];
  for (const r of rows) {
    if (typeof r === "string" && r.trim()) themes.push(r.trim());
    else if (isRecord(r) && typeof r.name === "string" && r.name.trim()) themes.push(r.name.trim());
    else if (isRecord(r) && typeof r.theme === "string" && r.theme.trim()) themes.push(r.theme.trim());
  }

  // If your themes endpoint isn't paginated, this is enough.
  // If it is, and it returns x-total-count, fetch remaining pages:
  const totalPages =
    first.totalCount != null ? Math.max(1, Math.ceil(first.totalCount / limit)) : 1;

  for (let page = 2; page <= totalPages; page++) {
    const url = `${apiBase()}${THEMES_INDEX}?limit=${limit}&page=${page}`;
    const { data } = await fetchJsonWithCount(url);
    const more = pickResultsArray(data);
    for (const r of more) {
      if (typeof r === "string" && r.trim()) themes.push(r.trim());
      else if (isRecord(r) && typeof r.name === "string" && r.name.trim()) themes.push(r.name.trim());
      else if (isRecord(r) && typeof r.theme === "string" && r.theme.trim()) themes.push(r.theme.trim());
    }
  }

  const uniq = Array.from(new Set(themes));
  return uniq.map((t) => `/themes/${encodeURIComponent(t)}`);
}

async function collectPublicListUrls(): Promise<string[]> {
  const limit = 200;
  const firstUrl = `${apiBase()}${PUBLIC_LISTS_INDEX}?limit=${limit}&page=1`;

  const first = await fetchJsonWithCount(firstUrl);
  const rows = pickResultsArray(first.data);

  const ids: Array<string> = [];
  for (const r of rows) {
    if (!isRecord(r)) continue;
    const id = r.id;
    if (typeof id === "string" && id.trim()) ids.push(id.trim());
    if (typeof id === "number" && Number.isFinite(id)) ids.push(String(id));
  }

  const totalPages =
    first.totalCount != null ? Math.max(1, Math.ceil(first.totalCount / limit)) : 1;

  // same fallback pattern
  const pagesToFetch =
    totalPages > 1 ? totalPages : rows.length === limit ? 5 : 1;

  for (let page = 2; page <= pagesToFetch; page++) {
    const url = `${apiBase()}${PUBLIC_LISTS_INDEX}?limit=${limit}&page=${page}`;
    const { data } = await fetchJsonWithCount(url);
    const more = pickResultsArray(data);

    let added = 0;
    for (const r of more) {
      if (!isRecord(r)) continue;
      const id = r.id;
      if (typeof id === "string" && id.trim()) {
        ids.push(id.trim());
        added++;
      } else if (typeof id === "number" && Number.isFinite(id)) {
        ids.push(String(id));
        added++;
      }
    }
    if (totalPages === 1 && added === 0) break;
  }

  const uniq = Array.from(new Set(ids));
  return uniq.map((id) => `/lists/${encodeURIComponent(id)}`);
}

export async function GET() {
  const base = siteBase();
  const now = new Date().toISOString();

  // ✅ “SEO pages (as they appear)” — add/remove as you want
  const staticPaths: UrlEntry[] = [
    { loc: `${base}/`, changefreq: "daily", priority: 1.0, lastmod: now },
    { loc: `${base}/themes`, changefreq: "weekly", priority: 0.8, lastmod: now },
    { loc: `${base}/years`, changefreq: "weekly", priority: 0.7, lastmod: now },
    { loc: `${base}/discover`, changefreq: "weekly", priority: 0.7, lastmod: now },
    { loc: `${base}/sale`, changefreq: "daily", priority: 0.7, lastmod: now },
    { loc: `${base}/new`, changefreq: "daily", priority: 0.7, lastmod: now },
    { loc: `${base}/retiring-soon`, changefreq: "weekly", priority: 0.7, lastmod: now },
    { loc: `${base}/lists/public`, changefreq: "weekly", priority: 0.6, lastmod: now },
    { loc: `${base}/affiliate-disclosure`, changefreq: "yearly", priority: 0.2, lastmod: now },
    { loc: `${base}/privacy`, changefreq: "yearly", priority: 0.2, lastmod: now },
    { loc: `${base}/terms`, changefreq: "yearly", priority: 0.2, lastmod: now },
  ];

  // Dynamic pages (best-effort; don’t fail sitemap if API fails)
  const [setPaths, themePaths, publicListPaths] = await Promise.all([
    collectSetUrls().catch(() => []),
    collectThemeUrls().catch(() => []),
    collectPublicListUrls().catch(() => []),
  ]);

  const dynamicEntries: UrlEntry[] = [
    ...themePaths.map(
      (p): UrlEntry => ({
        loc: `${base}${p}`,
        changefreq: "weekly",
        priority: 0.6,
      })
    ),
    ...setPaths.map(
      (p): UrlEntry => ({
        loc: `${base}${p}`,
        changefreq: "monthly",
        priority: 0.5,
      })
    ),
    ...publicListPaths.map(
      (p): UrlEntry => ({
        loc: `${base}${p}`,
        changefreq: "weekly",
        priority: 0.4,
      })
    ),
  ];

  const xml = toSitemapXml([...staticPaths, ...dynamicEntries]);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // cache if you want; safe default is no-store since it changes often
      "Cache-Control": "no-store",
    },
  });
}