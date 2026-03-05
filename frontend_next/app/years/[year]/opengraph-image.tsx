// frontend_next/app/years/[year]/opengraph-image.tsx
import { ImageResponse } from "next/og";
import { apiBase } from "@/lib/api";
import { siteBase } from "@/lib/url";
import { isRecord, type UnknownRecord } from "@/lib/types";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";

// ✅ tell Next this can be cached (ISR)
export const revalidate = 3600;

type SetSummary = { theme?: string | null };

function hostLabel(): string {
  return siteBase().replace(/^https?:\/\//, "");
}

function getArrayField(v: unknown, key: string): unknown[] | null {
  if (!isRecord(v)) return null;
  const val = v[key];
  return Array.isArray(val) ? val : null;
}

function normalizeRows(data: unknown): SetSummary[] {
  const arr = Array.isArray(data) ? data : getArrayField(data, "results") ?? [];
  return arr.filter((x): x is SetSummary => isRecord(x));
}

function topThemes(rows: SetSummary[], max = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const t = String(r.theme ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

async function fetchYearSummary(year: number) {
  const params = new URLSearchParams({ year: String(year), page: "1", limit: "36" });
  const url = `${apiBase()}/sets?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return { total: null as number | null, themes: [] as string[], debug: `bad_status url=${url} status=${res.status}` };

    const header = res.headers.get("x-total-count") || res.headers.get("X-Total-Count");
    const parsed = header ? Number(header) : NaN;
    const total = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

    const data: unknown = await res.json().catch(() => null);
    const rows = normalizeRows(data);
    const themes = topThemes(rows, 3);

    const debug = `ok url=${url} total=${total ?? "null"} themes=${themes.join("|")}`;
    return { total, themes, debug };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { total: null as number | null, themes: [] as string[], debug: `fetch_error url=${url} err=${msg}` };
  }
}

export default async function OpenGraphImage({
  params,
}: {
  params: { year: string } | Promise<{ year: string }>;
}) {
  const { year } = await params;
  const y = Math.floor(Number(year));
  const yearLabel = Number.isFinite(y) ? String(y) : String(year);

  const { total, themes, debug } = Number.isFinite(y)
    ? await fetchYearSummary(y)
    : { total: null as number | null, themes: [] as string[], debug: `bad_param year=${String(year)}` };

  const subtitle = total != null ? `${total.toLocaleString()} sets` : "Browse sets • Track ratings • Share lists";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 80,
          background: "#0B0B0B",
          color: "white",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 78, fontWeight: 900, letterSpacing: -1 }}>Sets from {yearLabel}</div>

          <div style={{ fontSize: 34, opacity: 0.82 }}>{subtitle}</div>

          {themes.length > 0 ? (
            <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              {themes.map((t) => (
                <div
                  key={t}
                  style={{
                    display: "flex",
                    fontSize: 22,
                    padding: "10px 14px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    opacity: 0.95,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ fontSize: 22, opacity: 0.55, marginTop: 16 }}>{hostLabel()}</div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // ✅ prod/CDN caching (works even if Next tries to be conservative)
        "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=31536000",
        "x-og-debug": debug,
      },
    }
  );
}