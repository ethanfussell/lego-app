// frontend_next/app/sets/[setNum]/opengraph-image.tsx
import React from "react";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 3600;

export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";

const OG_CACHE_CONTROL = "public, max-age=0, s-maxage=3600, stale-while-revalidate=31536000";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
}

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function hostLabel(): string {
  return siteBase().replace(/^https?:\/\//, "");
}

function safeTrim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeSetNum(raw: unknown): string | null {
  const s = decodeURIComponent(String(raw ?? "")).trim();
  if (!s) return null;
  if (!/^[A-Za-z0-9\-_.]+$/.test(s)) return null;
  return s;
}

type SetDetail = {
  set_num?: string;
  name?: string | null;
  year?: number | null;
  theme?: string | null;
  image_url?: string | null;
};

function ogHeaders(debug: string) {
  return {
    "content-type": "image/png",
    "cache-control": OG_CACHE_CONTROL,
    "x-og-debug": debug,
  };
}

async function fetchSet(setNum: string): Promise<{ set: SetDetail | null; debug: string }> {
  const url = `${apiBase()}/sets/${encodeURIComponent(setNum)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { set: null, debug: `fetch_error url=${url} err=${msg}` };
  }

  if (!res.ok) return { set: null, debug: `bad_status url=${url} status=${res.status}` };

  const data: unknown = await res.json().catch(() => null);
  if (!data || typeof data !== "object") return { set: null, debug: `bad_json url=${url}` };

  const o = data as Record<string, unknown>;
  const set: SetDetail = {
    set_num: safeTrim(o.set_num),
    name: safeTrim(o.name) || null,
    year: typeof o.year === "number" && Number.isFinite(o.year) ? o.year : null,
    theme: safeTrim(o.theme) || null,
    image_url: safeTrim(o.image_url) || null,
  };

  return { set, debug: `ok url=${url} set_num=${set.set_num ?? ""} name=${set.name ?? ""}` };
}

function baseCard(children: React.ReactNode) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 72,
        background: "#0B0B0B",
        color: "white",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      {children}
    </div>
  );
}

function fallbackOG(debug: string) {
  return new ImageResponse(
    baseCard(
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 72, fontWeight: 800 }}>LEGO App</div>
        <div style={{ fontSize: 32, opacity: 0.75 }}>Discover sets • Track ratings • Share lists</div>
        <div style={{ fontSize: 22, opacity: 0.55 }}>{hostLabel()}</div>
        <div style={{ marginTop: 18, fontSize: 16, opacity: 0.35 }}>{debug}</div>
      </div>
    ),
    {
      ...size,
      headers: ogHeaders(debug),
    }
  );
}

export default async function OpenGraphImage({
  params,
}: {
  params: { setNum?: string } | Promise<{ setNum?: string }>;
}) {
  const p = await Promise.resolve(params);
  const raw = p?.setNum ?? "";
  const setNum = normalizeSetNum(raw);

  if (!setNum) return fallbackOG(`bad_param setNum=${String(raw)}`);

  const { set, debug } = await fetchSet(setNum);

  const title = safeTrim(set?.name) || safeTrim(set?.set_num) || setNum;

  const subtitleParts = [
    safeTrim(set?.set_num) || setNum,
    typeof set?.year === "number" ? String(set.year) : "",
    safeTrim(set?.theme),
  ].filter(Boolean);

  const subtitle = subtitleParts.join(" • ");
  const img = safeTrim(set?.image_url) || "";

  return new ImageResponse(
    baseCard(
      <div style={{ width: "100%", display: "flex", gap: 56 }}>
        {/* left: image */}
        <div
          style={{
            width: 460,
            height: 460,
            borderRadius: 32,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                padding: 24,
              }}
            />
          ) : (
            <div style={{ fontSize: 22, opacity: 0.6 }}>No image</div>
          )}
        </div>

        {/* right: text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            gap: 18,
          }}
        >
          <div style={{ fontSize: 74, fontWeight: 900, lineHeight: 1.06 }}>{title}</div>
          <div style={{ fontSize: 30, opacity: 0.8 }}>{subtitle}</div>
          <div style={{ marginTop: 16, fontSize: 22, opacity: 0.55 }}>{hostLabel()}</div>
          <div style={{ marginTop: 18, fontSize: 16, opacity: 0.35 }}>{debug}</div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: ogHeaders(debug),
    }
  );
}