// frontend_next/app/sitemap.xml/route.ts
import { NextResponse } from "next/server";
import { themeToSlug } from "@/lib/slug";

export const runtime = "nodejs";

function siteBase(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;

  if (process.env.NODE_ENV === "production" && !env) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be set in production");
  }

  return (env || "http://localhost:3000").replace(/\/+$/, "");
}

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
}

const SETS_INDEX = "/sets";
const THEMES_INDEX = "/themes";
const PUBLIC_LISTS_INDEX = "/lists/public";

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickArrayOrResults(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.results)) return data.results as unknown[];
  return [];
}

// --- NEW: fetch with timeout (prevents hangs that cause "Couldn't fetch") ---
async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 8000, ...rest } = opts;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchJsonWithCount(
  url: string
): Promise<{ data: unknown; totalCount: number | null; status: number }> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url, { cache: "no-store", timeoutMs: 8000 });
  } catch {
    // Network error / timeout
    return { data: null, totalCount: null, status: 0 };
  }

  const status = res.status;
  if (!res.ok) return { data: null, totalCount: null, status };

  const header = res.headers.get("x-total-count") || res.headers.get("X-Total-Count");
  const parsed = header ? Number(header) : NaN;
  const totalCount = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

  const data: unknown = await res.json().catch(() => null);
  return { data, totalCount, status };
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

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`
  );
}

async function collectSetUrls(): Promise<{ paths: string[]; rawCount: number }> {
  const limit = 100;
  const firstUrl = `${apiBase()}${SETS_INDEX}?limit=${limit}&page=1`;

  const first = await fetchJsonWithCount(firstUrl);
  const firstRows = pickArrayOrResults(first.data);

  const setNums: string[] = [];

  const readSet = (r: unknown) => {
    if (!isRecord(r)) return;
    const sn =
      r.set_num ??
      r["set_num"] ??
      r.setNum ??
      r["setNum"] ??
      r.set_number ??
      r["set_number"];
    if (typeof sn === "string" && sn.trim()) setNums.push(sn.trim());
  };

  firstRows.forEach(readSet);

  const totalPages = first.totalCount != null ? Math.max(1, Math.ceil(first.totalCount / limit)) : 1;
  const pagesToFetch = totalPages > 1 ? totalPages : firstRows.length === limit ? 5 : 1;

  for (let page = 2; page <= pagesToFetch; page++) {
    const url = `${apiBase()}${SETS_INDEX}?limit=${limit}&page=${page}`;
    const next = await fetchJsonWithCount(url);
    const rows = pickArrayOrResults(next.data);

    const before = setNums.length;
    rows.forEach(readSet);

    if (totalPages === 1 && setNums.length === before) break;
  }

  const uniq = Array.from(new Set(setNums));
  return { rawCount: uniq.length, paths: uniq.map((sn) => `/sets/${encodeURIComponent(sn)}`) };
}

async function collectThemeUrls(): Promise<{
  paths: string[];
  rawThemes: string[];
  badSlugThemes: string[];
}> {
  const limit = 100;
  const firstUrl = `${apiBase()}${THEMES_INDEX}?limit=${limit}&page=1`;

  const first = await fetchJsonWithCount(firstUrl);
  const firstRows = pickArrayOrResults(first.data);

  const themes: string[] = [];

  const readTheme = (r: unknown) => {
    if (!isRecord(r)) return;
    const t = r.theme ?? r["theme"] ?? r.name ?? r["name"];
    if (typeof t === "string" && t.trim()) themes.push(t.trim());
  };

  firstRows.forEach(readTheme);

  const totalPages = first.totalCount != null ? Math.max(1, Math.ceil(first.totalCount / limit)) : 1;
  for (let page = 2; page <= totalPages; page++) {
    const url = `${apiBase()}${THEMES_INDEX}?limit=${limit}&page=${page}`;
    const next = await fetchJsonWithCount(url);
    pickArrayOrResults(next.data).forEach(readTheme);
  }

  const uniqThemes = Array.from(new Set(themes));

  const badSlugThemes: string[] = [];
  const themePaths: string[] = [];

  for (const t of uniqThemes) {
    try {
      const slug = themeToSlug(t);
      if (typeof slug === "string" && slug.trim()) themePaths.push(`/themes/${slug}`);
      else badSlugThemes.push(t);
    } catch {
      badSlugThemes.push(t);
    }
  }

  return { paths: themePaths, rawThemes: uniqThemes, badSlugThemes };
}

async function collectPublicListUrls(): Promise<{ paths: string[]; rawCount: number }> {
  const limit = 200;
  const firstUrl = `${apiBase()}${PUBLIC_LISTS_INDEX}?limit=${limit}&page=1`;

  const first = await fetchJsonWithCount(firstUrl);
  const rows = pickArrayOrResults(first.data);

  const ids: string[] = [];

  const readId = (r: unknown) => {
    if (!isRecord(r)) return;
    const id = r.id ?? r["id"];
    if (typeof id === "string" && id.trim()) ids.push(id.trim());
    else if (typeof id === "number" && Number.isFinite(id)) ids.push(String(id));
  };

  rows.forEach(readId);

  const totalPages = first.totalCount != null ? Math.max(1, Math.ceil(first.totalCount / limit)) : 1;
  const pagesToFetch = totalPages > 1 ? totalPages : rows.length === limit ? 5 : 1;

  for (let page = 2; page <= pagesToFetch; page++) {
    const url = `${apiBase()}${PUBLIC_LISTS_INDEX}?limit=${limit}&page=${page}`;
    const next = await fetchJsonWithCount(url);
    const more = pickArrayOrResults(next.data);

    const before = ids.length;
    more.forEach(readId);

    if (totalPages === 1 && ids.length === before) break;
  }

  const uniq = Array.from(new Set(ids));
  return { rawCount: uniq.length, paths: uniq.map((id) => `/lists/${encodeURIComponent(id)}`) };
}

export async function GET() {
  const base = siteBase();
  const now = new Date().toISOString();
  const api = apiBase();

  // --- Make probes best-effort (never block sitemap) ---
  const themesProbeUrl = `${api}${THEMES_INDEX}?limit=5&page=1`;
  const setsProbeUrl = `${api}${SETS_INDEX}?limit=5&page=1`;

  let themesProbeStatus = 0;
  let setsProbeStatus = 0;
  let themesProbeCount = 0;
  let setsProbeCount = 0;

  try {
    const themesProbe = await fetchJsonWithCount(themesProbeUrl);
    themesProbeStatus = themesProbe.status;
    themesProbeCount = pickArrayOrResults(themesProbe.data).length;
  } catch {}

  try {
    const setsProbe = await fetchJsonWithCount(setsProbeUrl);
    setsProbeStatus = setsProbe.status;
    setsProbeCount = pickArrayOrResults(setsProbe.data).length;
  } catch {}

  const staticEntries: UrlEntry[] = [
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

  let setPaths: string[] = [];
  let themePaths: string[] = [];
  let publicListPaths: string[] = [];

  let setsRawCount = 0;
  let themesRawCount = 0;
  let themesBadSlugCount = 0;
  let themesBadSlugSample = "";

  try {
    const sets = await collectSetUrls();
    setPaths = sets.paths;
    setsRawCount = sets.rawCount;
  } catch {}

  try {
    const themes = await collectThemeUrls();
    themePaths = themes.paths;
    themesRawCount = themes.rawThemes.length;
    themesBadSlugCount = themes.badSlugThemes.length;
    themesBadSlugSample = themes.badSlugThemes[0]
      ? String(themes.badSlugThemes[0]).slice(0, 120)
      : "";
  } catch {}

  try {
    const lists = await collectPublicListUrls();
    publicListPaths = lists.paths;
  } catch {}

  const dynamicEntries: UrlEntry[] = [
    ...themePaths.map((p) => ({ loc: `${base}${p}`, changefreq: "weekly" as const, priority: 0.6 })),
    ...setPaths.map((p) => ({ loc: `${base}${p}`, changefreq: "monthly" as const, priority: 0.5 })),
    ...publicListPaths.map((p) => ({ loc: `${base}${p}`, changefreq: "weekly" as const, priority: 0.4 })),
  ];

  const xml = toSitemapXml([...staticEntries, ...dynamicEntries]);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",

      "X-Sitemap-Route": "v3",
      "X-Sitemap-ApiBase": api,

      "X-Sitemap-ThemesURL": themesProbeUrl,
      "X-Sitemap-ThemesStatus": String(themesProbeStatus),
      "X-Sitemap-ThemesProbeCount": String(themesProbeCount),

      "X-Sitemap-SetsURL": setsProbeUrl,
      "X-Sitemap-SetsStatus": String(setsProbeStatus),
      "X-Sitemap-SetsProbeCount": String(setsProbeCount),

      "X-Sitemap-Themes": String(themePaths.length),
      "X-Sitemap-ThemesRaw": String(themesRawCount),
      "X-Sitemap-ThemesBadSlug": String(themesBadSlugCount),
      "X-Sitemap-ThemesBadSlugSample": themesBadSlugSample,

      "X-Sitemap-Sets": String(setPaths.length),
      "X-Sitemap-SetsRaw": String(setsRawCount),

      "X-Sitemap-PublicLists": String(publicListPaths.length),
    },
  });
}