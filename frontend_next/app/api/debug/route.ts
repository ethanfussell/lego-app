// frontend_next/app/api/debug/route.ts
// Diagnostic endpoint — visit /api/debug on the deployed site to see what's happening
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function apiBaseInfo() {
  return {
    API_BASE_URL: process.env.API_BASE_URL || "(not set)",
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "(not set)",
    NODE_ENV: process.env.NODE_ENV || "(not set)",
    resolved: process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000 (FALLBACK - this is the problem!)",
  };
}

export async function GET() {
  const env = apiBaseInfo();
  const base = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const results: Record<string, unknown> = { env };

  // Test: can we reach the backend health endpoint?
  try {
    const healthRes = await fetch(`${base}/health`, { cache: "no-store" });
    results.health = { status: healthRes.status, ok: healthRes.ok, body: await healthRes.json().catch(() => null) };
  } catch (e) {
    results.health = { error: e instanceof Error ? e.message : String(e) };
  }

  // Test: fetch 2 themes and check for image_url
  try {
    const themesRes = await fetch(`${base}/themes?limit=2`, { cache: "no-store" });
    const body = await themesRes.json().catch(() => null);
    results.themes_sample = {
      status: themesRes.status,
      count: Array.isArray(body) ? body.length : "not an array",
      data: Array.isArray(body) ? body.slice(0, 2) : body,
    };
  } catch (e) {
    results.themes_sample = { error: e instanceof Error ? e.message : String(e) };
  }

  // Test: fetch retiring sets count
  try {
    const retRes = await fetch(`${base}/sets/retiring?limit=1`, { cache: "no-store" });
    const retBody = await retRes.json().catch(() => null);
    results.retiring = {
      status: retRes.status,
      total: retRes.headers.get("x-total-count"),
      sample_count: Array.isArray(retBody) ? retBody.length : "not an array",
    };
  } catch (e) {
    results.retiring = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json(results, {
    headers: { "cache-control": "no-store" },
  });
}
