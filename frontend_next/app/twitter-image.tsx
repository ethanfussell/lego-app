// frontend_next/app/twitter-image.tsx
import type { ImageResponse } from "next/og";
import OG from "./opengraph-image";

// ✅ declare these here (do NOT re-export)
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default export must be a function returning ImageResponse
export default function TwitterImage(): ImageResponse {
  // opengraph-image default export is a function that returns ImageResponse
  return OG();
}