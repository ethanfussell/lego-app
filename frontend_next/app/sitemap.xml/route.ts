// frontend_next/app/sitemap.xml/route.ts
import { NextResponse } from "next/server";
import { themeToSlug } from "@/lib/slug";

export const runtime = "nodejs";

// ---------------- config ----------------

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

// Custom static “best under N pieces” pages
const PIECES_UNDER_THRESHOLDS = [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000] as const;

// OPTION A: ONLY curated /themes/{slug}/top pages in the sitemap.
const TOP_THEMES = [
  "Star Wars",
  "Duplo",
  "City",
  "Town",
  "Friends",
  "Educational and Dacta",
  "Creator",
  "Technic",
  "Ninjago",
  "Seasonal",
] as const;

// Theme exists in /themes list, but /themes/{name}/sets 404s -> keep out of sitemap.
const SITEMAP_THEME_DENYLIST = new Set<string>(["Dino Attack / Dino 2010"]);

// ---------------- utils ----------------

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickArrayOrResults(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.results)) return data.results;
  return [];
}

function asTrimmedString(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : String(v ?? "").trim();
  return s ? s : null;
}

function asFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
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
    .map((e) =>
      [
        "<url>",
        `  <loc>${xmlEscape(e.loc)}</loc>`,
        e.lastmod ? `  <lastmod>${xmlEscape(e.lastmod)}</lastmod>` : null,
        e.changefreq ? `  <changefreq>${e.changefreq}</changefreq>` : null,
        typeof e.priority === "number" ? `  <priority>${e.priority.toFixed(1)}</priority>` : null,
        "</url>",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`
  );
}

// --- fetch with timeout (prevents hangs that cause "Couldn't fetch") ---
async function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 8000, ...rest } = opts;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchJsonWithCount(url: string): Promise<{ data: unknown; totalCount: number | null; status: number }> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url, { cache: "no-store", timeoutMs: 8000 });
  } catch {
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

function yearRange(min = 1980, max = new Date().getFullYear()): number[] {
  const out: number[] = [];
  for (let y = max; y >= min; y--) out.push(y);
  return out;
}

function readSetNum(r: unknown): string | null {
  if (!isRecord(r)) return null;

  const sn =
    r.set_num ??
    r.setNum ??
    r.set_number ??
    (r as UnknownRecord)["set_num"] ??
    (r as UnknownRecord)["setNum"] ??
    (r as UnknownRecord)["set_number"];

  return asTrimmedString(sn);
}

function readThemeName(r: unknown): string | null {
  if (!isRecord(r)) return null;
  const t = r.theme ?? r.name ?? (r as UnknownRecord)["theme"] ?? (r as UnknownRecord)["name"];
  return asTrimmedString(t);
}

function readPublicListId(r: unknown): string | null {
  if (!isRecord(r)) return null;
  const id = r.id ?? (r as UnknownRecord)["id"];
  if (typeof id === "string") return asTrimmedString(id);
  const n = asFiniteNumber(id);
  return n != null ? String(Math.floor(n)) : null;
}

function readPublicListOwner(r: unknown): string | null {
  if (!isRecord(r)) return null;

  return (
    asTrimmedString(r.owner_username) ||
    asTrimmedString(r.owner) ||
    asTrimmedString(r.username) ||
    asTrimmedString((r as UnknownRecord)["owner_username"]) ||
    asTrimmedString((r as UnknownRecord)["owner"]) ||
    asTrimmedString((r as UnknownRecord)["username"])
  );
}

// ---------------- collectors ----------------

async function collectSetUrls(): Promise<{ paths: string[]; rawCount: number }> {
  const limit = 100;
  const firstUrl = `${apiBase()}${SETS_INDEX}?limit=${limit}&page=1`;

  const first = await fetchJsonWithCount(firstUrl);
  const firstRows = pickArrayOrResults(first.data);

  const setNums: string[] = [];
  for (const r of firstRows) {
    const sn = readSetNum(r);
    if (sn) setNums.push(sn);
  }

  const totalPages = first.totalCount != null ? Math.max(1, Math.ceil(first.totalCount / limit)) : 1;
  const pagesToFetch = totalPages > 1 ? totalPages : firstRows.length === limit ? 5 : 1;

  for (let page = 2; page <= pagesToFetch; page++) {
    const url = `${apiBase()}${SETS_INDEX}?limit=${limit}&page=${page}`;
    const next = await fetchJsonWithCount(url);
    const rows = pickArrayOrResults(next.data);

    const before = setNums.length;

    for (const r of rows) {
      const sn = readSetNum(r);
      if (sn) setNums.push(sn);
    }

    if (totalPages === 1 && setNums.length === before) break;
  }

  const uniq = Array.from(new Set(setNums));
  return { rawCount: uniq.length, paths: uniq.map((sn) => `/sets/${encodeURIComponent(sn)}`) };
}

async function collectThemeUrls(): Promise<{
  paths: string[];
  rawThemes: string[];
  badSlugThemes: string[];
  skippedThemes: string[];
}> {
  const limit = 100;
  const firstUrl = `${apiBase()}${THEMES_INDEX}?limit=${limit}&page=1`;

  const first = await fetchJsonWithCount(firstUrl);
  const firstRows = pickArrayOrResults(first.data);

  const themes: string[] = [];
  for (const r of firstRows) {
    const t = readThemeName(r);
    if (t) themes.push(t);
  }

  const totalPages = first.totalCount != null ? Math.max(1, Math.ceil(first.totalCount / limit)) : 1;
  for (let page = 2; page <= totalPages; page++) {
    const url = `${apiBase()}${THEMES_INDEX}?limit=${limit}&page=${page}`;
    const next = await fetchJsonWithCount(url);

    for (const r of pickArrayOrResults(next.data)) {
      const t = readThemeName(r);
      if (t) themes.push(t);
    }
  }

  const uniqThemes = Array.from(new Set(themes));

  const badSlugThemes: string[] = [];
  const skippedThemes: string[] = [];
  const themePaths: string[] = [];

  for (const t of uniqThemes) {
    if (SITEMAP_THEME_DENYLIST.has(t)) {
      skippedThemes.push(t);
      continue;
    }

    try {
      const slug = themeToSlug(t);
      if (typeof slug === "string" && slug.trim()) {
        themePaths.push(`/themes/${slug}`);
      } else {
        badSlugThemes.push(t);
      }
    } catch {
      badSlugThemes.push(t);
    }
  }

  return { paths: themePaths, rawThemes: uniqThemes, badSlugThemes, skippedThemes };
}

/**
 * Collect BOTH:
 * - public list detail URLs: /lists/{id}
 * - public user profile URLs: /users/{owner}
 */
async function collectPublicListAndUserUrls(): Promise<{
  listPaths: string[];
  userPaths: string[];
  rawListCount: number;
  rawUserCount: number;
}> {
  const limit = 200;
  const firstUrl = `${apiBase()}${PUBLIC_LISTS_INDEX}?limit=${limit}&page=1`;

  const first = await fetchJsonWithCount(firstUrl);
  const rows = pickArrayOrResults(first.data);

  const ids: string[] = [];
  const users: string[] = [];

  const readRow = (r: unknown) => {
    const id = readPublicListId(r);
    if (id) ids.push(id);

    const owner = readPublicListOwner(r);
    if (owner) users.push(owner);
  };

  rows.forEach(readRow);

  const totalPages = first.totalCount != null ? Math.max(1, Math.ceil(first.totalCount / limit)) : 1;
  const pagesToFetch = totalPages > 1 ? totalPages : rows.length === limit ? 5 : 1;

  for (let page = 2; page <= pagesToFetch; page++) {
    const url = `${apiBase()}${PUBLIC_LISTS_INDEX}?limit=${limit}&page=${page}`;
    const next = await fetchJsonWithCount(url);
    const more = pickArrayOrResults(next.data);

    const before = ids.length;
    more.forEach(readRow);

    if (totalPages === 1 && ids.length === before) break;
  }

  const uniqIds = Array.from(new Set(ids));
  const uniqUsers = Array.from(new Set(users));

  return {
    rawListCount: uniqIds.length,
    rawUserCount: uniqUsers.length,
    listPaths: uniqIds.map((id) => `/lists/${encodeURIComponent(id)}`),
    userPaths: uniqUsers.map((u) => `/users/${encodeURIComponent(u)}`),
  };
}

// ---------------- handler ----------------

export async function GET() {
  const base = siteBase();
  const now = new Date().toISOString();
  const api = apiBase();

  // Probes (best-effort)
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

  // Static pages
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
    { loc: `${base}/pieces/most`, changefreq: "weekly", priority: 0.5, lastmod: now },
    
    // Hub
    { loc: `${base}/themes/top`, changefreq: "weekly", priority: 0.6, lastmod: now },

    // Pieces “best under N” pages
    ...PIECES_UNDER_THRESHOLDS.map((n) => ({
      loc: `${base}/pieces/under/${n}/best`,
      changefreq: "weekly" as const,
      priority: 0.5,
      lastmod: now,
    })),

    // Curated “top theme” pages — ONLY these (Option A)
    ...TOP_THEMES.map((t) => {
      const slug = themeToSlug(t);
      return {
        loc: `${base}/themes/${slug}/top`,
        changefreq: "weekly" as const,
        priority: 0.5,
        lastmod: now,
      };
    }),
  ];

  // Year pages + year top pages
  const years = yearRange(1980, new Date().getFullYear());
  const yearEntries: UrlEntry[] = [
    ...years.map((y) => ({
      loc: `${base}/years/${y}`,
      changefreq: "weekly" as const,
      priority: 0.4,
      lastmod: now,
    })),
    ...years.map((y) => ({
      loc: `${base}/years/${y}/top`,
      changefreq: "weekly" as const,
      priority: 0.5,
      lastmod: now,
    })),
  ];

  // Dynamic pages
  let setPaths: string[] = [];
  let themePaths: string[] = [];
  let publicListPaths: string[] = [];
  let userProfilePaths: string[] = [];

  let setsRawCount = 0;
  let themesRawCount = 0;
  let themesBadSlugCount = 0;
  let themesBadSlugSample = "";
  let themesSkippedCount = 0;
  let themesSkippedSample = "";

  let publicListsRawCount = 0;
  let usersRawCount = 0;

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
    themesBadSlugSample = themes.badSlugThemes[0] ? String(themes.badSlugThemes[0]).slice(0, 120) : "";
    themesSkippedCount = themes.skippedThemes.length;
    themesSkippedSample = themes.skippedThemes[0] ? String(themes.skippedThemes[0]).slice(0, 120) : "";
  } catch {}

  try {
    const listsAndUsers = await collectPublicListAndUserUrls();
    publicListPaths = listsAndUsers.listPaths;
    userProfilePaths = listsAndUsers.userPaths;
    publicListsRawCount = listsAndUsers.rawListCount;
    usersRawCount = listsAndUsers.rawUserCount;
  } catch {}

  const dynamicEntries: UrlEntry[] = [
    // All theme pages (/themes/{slug})
    ...themePaths.map((p) => ({ loc: `${base}${p}`, changefreq: "weekly" as const, priority: 0.6 })),

    // Option A: DO NOT include /themes/{slug}/top for all themes here.
    ...setPaths.map((p) => ({ loc: `${base}${p}`, changefreq: "monthly" as const, priority: 0.5 })),

    ...publicListPaths.map((p) => ({ loc: `${base}${p}`, changefreq: "weekly" as const, priority: 0.4 })),
    ...userProfilePaths.map((p) => ({ loc: `${base}${p}`, changefreq: "weekly" as const, priority: 0.3 })),
  ];

  // De-dupe
  const allEntries = [...staticEntries, ...yearEntries, ...dynamicEntries];
  const seen = new Set<string>();
  const uniqEntries = allEntries.filter((e) => {
    if (seen.has(e.loc)) return false;
    seen.add(e.loc);
    return true;
  });

  const xml = toSitemapXml(uniqEntries);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",

      "X-Sitemap-Route": "v8",
      "X-Sitemap-ApiBase": api,

      "X-Sitemap-ThemesURL": themesProbeUrl,
      "X-Sitemap-ThemesStatus": String(themesProbeStatus),
      "X-Sitemap-ThemesProbeCount": String(themesProbeCount),

      "X-Sitemap-SetsURL": setsProbeUrl,
      "X-Sitemap-SetsStatus": String(setsProbeStatus),
      "X-Sitemap-SetsProbeCount": String(setsProbeCount),

      "X-Sitemap-Themes": String(themePaths.length),
      "X-Sitemap-ThemesTop": String(TOP_THEMES.length),
      "X-Sitemap-ThemesRaw": String(themesRawCount),
      "X-Sitemap-ThemesBadSlug": String(themesBadSlugCount),
      "X-Sitemap-ThemesBadSlugSample": themesBadSlugSample,
      "X-Sitemap-ThemesSkipped": String(themesSkippedCount),
      "X-Sitemap-ThemesSkippedSample": themesSkippedSample,

      "X-Sitemap-Sets": String(setPaths.length),
      "X-Sitemap-SetsRaw": String(setsRawCount),

      "X-Sitemap-PublicLists": String(publicListPaths.length),
      "X-Sitemap-PublicListsRaw": String(publicListsRawCount),

      "X-Sitemap-Users": String(userProfilePaths.length),
      "X-Sitemap-UsersRaw": String(usersRawCount),

      "X-Sitemap-Years": String(years.length),
    },
  });
}