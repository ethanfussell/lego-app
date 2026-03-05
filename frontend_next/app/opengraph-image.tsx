import { ImageResponse } from "next/og";
import { siteBase } from "@/lib/url";


export const runtime = "nodejs";
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";

function hostLabel(): string {
  return siteBase().replace(/^https?:\/\//, "");
}

export default function OpenGraphImage() {
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 80, fontWeight: 900, letterSpacing: -1 }}>LEGO App</div>
          <div style={{ fontSize: 34, opacity: 0.78 }}>Discover sets • Track ratings • Share lists</div>
          <div style={{ fontSize: 22, opacity: 0.55 }}>{hostLabel()}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}