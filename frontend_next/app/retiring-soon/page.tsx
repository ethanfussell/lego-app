// frontend_next/app/retiring-soon/page.tsx
import type { Metadata } from "next";
import { apiFetch, apiBase } from "@/lib/api";
import RetiringSoonClient from "./RetiringSoonClient";
import { siteBase } from "@/lib/url";
import { isRecord, type SetLite } from "@/lib/types";
import { unwrapSearchParams, first, type SP } from "@/lib/searchParams";

export const dynamic = "force-dynamic";

type FeedResponse =
  | SetLite[]
  | {
      results?: unknown;
      total?: unknown;
      total_pages?: unknown;
      page?: unknown;
    };

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}): Promise<Metadata> {
  const sp = await unwrapSearchParams(searchParams);
  const page = toInt(first(sp, "page") || "1", 1);

  const title = "Retiring soon";
  const description = "LEGO sets expected to retire soon—browse and add your favorites before they're gone.";
  const canonicalPath = "/retiring-soon";

  const robots = page > 1 ? ({ index: false, follow: true } as const) : undefined;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    robots,
    openGraph: { title, description, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function isSetLite(x: unknown): x is SetLite {
  return isRecord(x) && typeof x.set_num === "string";
}

function toSetLiteArray(x: unknown): SetLite[] {
  return Array.isArray(x) ? x.filter(isSetLite) : [];
}

function asFeedResponse(x: unknown): FeedResponse {
  if (Array.isArray(x)) return toSetLiteArray(x);
  if (isRecord(x)) return { results: x.results };
  return [];
}

type RetiringPageConfig = {
  retiring_hidden_sets?: string;
  retiring_excluded_themes?: string;
};

async function fetchRetiringPageConfig(): Promise<RetiringPageConfig> {
  const url = `${apiBase()}/sets/retiring-page-config`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = await res.json().catch(() => null);
    return data || {};
  } catch {
    return {};
  }
}

async function fetchRetiringSoonSets(config: RetiringPageConfig): Promise<SetLite[]> {
  const raw = await apiFetch<unknown>(`/sets/retiring?limit=200`, { cache: "no-store" });
  const data = asFeedResponse(raw);

  const items: SetLite[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: unknown }).results)
      ? toSetLiteArray((data as { results?: unknown }).results)
      : [];

  // Build excluded themes from defaults + admin config
  const DEFAULT_EXCLUDED = ["SPIKE", "LEGO Exclusive", "Seasonal"];
  let excludedThemes: string[];
  if (config.retiring_excluded_themes) {
    try {
      const parsed = JSON.parse(config.retiring_excluded_themes);
      excludedThemes = Array.isArray(parsed) ? parsed : DEFAULT_EXCLUDED;
    } catch {
      excludedThemes = DEFAULT_EXCLUDED;
    }
  } else {
    excludedThemes = DEFAULT_EXCLUDED;
  }
  const excludedThemeSet = new Set(excludedThemes);

  // Build hidden set_nums from admin config
  let hiddenSetNums = new Set<string>();
  if (config.retiring_hidden_sets) {
    try {
      const parsed = JSON.parse(config.retiring_hidden_sets);
      if (Array.isArray(parsed)) {
        hiddenSetNums = new Set(parsed.map(String));
      }
    } catch {
      // ignore parse errors
    }
  }

  return items.filter((s) => {
    if (!s.set_num.trim()) return false;
    // Admin-hidden sets
    if (hiddenSetNums.has(s.set_num)) return false;
    const theme = typeof s.theme === "string" ? s.theme.trim() : "";
    if (excludedThemeSet.has(theme)) return false;
    if (/minifigure/i.test(theme)) return false;
    return true;
  });
}

export default async function Page() {
  let sets: SetLite[] = [];
  let error: string | null = null;

  const config = await fetchRetiringPageConfig();

  try {
    sets = await fetchRetiringSoonSets(config);
  } catch (e: unknown) {
    error = errorMessage(e);
  }

  return (
    <RetiringSoonClient
      initialSets={sets}
      initialError={error}
    />
  );
}
