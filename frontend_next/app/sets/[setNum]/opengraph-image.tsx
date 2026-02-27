import { ImageResponse } from "next/og";

export const runtime = "edge";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

type Params = { setNum: string };

type SetDetail = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string | null;
  image_url?: string | null;
};

async function fetchSet(setNum: string): Promise<SetDetail | null> {
  try {
    const url = `${apiBase()}/sets/${encodeURIComponent(setNum)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as unknown;
    if (!data || typeof data !== "object") return null;
    return data as SetDetail;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Params | Promise<Params> }) {
  const p = await Promise.resolve(params);
  const setNum = decodeURIComponent(String(p.setNum || "")).trim();

  const set = setNum ? await fetchSet(setNum) : null;

  const title = set?.name?.trim() ? set.name.trim() : `LEGO ${setNum || "Set"}`;
  const subtitleParts: string[] = [];
  if (set?.set_num) subtitleParts.push(set.set_num);
  if (typeof set?.year === "number") subtitleParts.push(String(set.year));
  if (typeof set?.pieces === "number") subtitleParts.push(`${set.pieces.toLocaleString()} pcs`);
  const subtitle = subtitleParts.join(" • ");

  const img = set?.image_url ? String(set.image_url) : null;

  // Simple branded OG layout (1200x630)
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "#0a0a0a",
          color: "white",
          padding: "48px",
          gap: "40px",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ fontSize: 26, opacity: 0.85 }}>BrickTrack</div>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
            <div style={{ fontSize: 26, opacity: 0.8 }}>{subtitle}</div>
            {set?.theme ? <div style={{ fontSize: 22, opacity: 0.7 }}>Theme: {set.theme}</div> : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: 18, opacity: 0.6 }}>{siteBase().replace(/^https?:\/\//, "")}</div>
            <div style={{ fontSize: 18, opacity: 0.6 }}>LEGO set details</div>
          </div>
        </div>

        <div
          style={{
            width: "430px",
            height: "534px",
            borderRadius: "28px",
            background: "#111",
            border: "1px solid rgba(255,255,255,0.12)",
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
                padding: "24px",
              }}
            />
          ) : (
            <div style={{ fontSize: 20, opacity: 0.7, padding: "24px", textAlign: "center" }}>
              No image available
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}