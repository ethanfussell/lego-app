"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SetCard from "@/app/components/SetCard";
import { useAuth } from "@/app/providers";

const PAGE_SIZE = 36;

/* ---------------- helpers ---------------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function buildPageItems(page: number, totalPages: number) {
  // Search-style: show first, last, current +/- 2, ellipses when needed
  const items = new Set<number | string>([
    1,
    totalPages,
    page - 2,
    page - 1,
    page,
    page + 1,
    page + 2,
  ]);

  const nums = [...items]
    .filter((p): p is number => typeof p === "number" && p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const out: Array<number | string> = [];
  let prev = 0;
  for (const p of nums) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

function prettyFromSlug(themeSlug: string) {
  const raw = decodeURIComponent(themeSlug || "Theme");
  // If the slug is already a human name (e.g. "BrickLink Designer Program"), keep it.
  if (raw.includes(" ")) return raw;
  // Otherwise convert "lego-city" -> "Lego City"
  return raw.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/* ---------------- types ---------------- */

type LegoSet = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string;
  image_url?: string;
  average_rating?: number | null;
  rating_avg?: number | null; // backend sometimes uses this
  rating_count?: number;
};

/* ---------------- sort (single dropdown like ListDetailPage) ---------------- */

type SortKey =
  | "year_desc"
  | "year_asc"
  | "name_asc"
  | "name_desc"
  | "pieces_desc"
  | "pieces_asc";

function sortKeyToBackend(sortKey: SortKey): { sort: "name" | "year" | "pieces"; order: "asc" | "desc" } {
  if (sortKey === "name_asc") return { sort: "name", order: "asc" };
  if (sortKey === "name_desc") return { sort: "name", order: "desc" };
  if (sortKey === "pieces_asc") return { sort: "pieces", order: "asc" };
  if (sortKey === "pieces_desc") return { sort: "pieces", order: "desc" };
  if (sortKey === "year_asc") return { sort: "year", order: "asc" };
  return { sort: "year", order: "desc" }; // default
}

/* ---------------- component ---------------- */

export default function ThemeDetailClient({ themeSlug }: { themeSlug: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { token } = useAuth();

  const themeName = useMemo(() => prettyFromSlug(themeSlug), [themeSlug]);

  const page = useMemo(() => {
    const raw = parseInt(sp.get("page") || "1", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }, [sp]);

  // ✅ single dropdown key (same style as ListDetailPage)
  const sortKey = useMemo(() => {
    const raw = (sp.get("sortKey") || "year_desc").trim() as SortKey;
    const allowed: SortKey[] = [
      "year_desc",
      "year_asc",
      "name_asc",
      "name_desc",
      "pieces_desc",
      "pieces_asc",
    ];
    return (allowed.includes(raw) ? raw : "year_desc") as SortKey;
  }, [sp]);

  const { sort, order } = useMemo(() => sortKeyToBackend(sortKey), [sortKey]);

  const [sets, setSets] = useState<LegoSet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
  const safePage = clamp(page, 1, totalPages);

  const hasResults = sets.length > 0;
  const pageItems = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages]);

  function makeHref(next: Record<string, string | number | null | undefined>) {
    const u = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") u.delete(k);
      else u.set(k, String(v));
    }
    const qs = u.toString();
    return qs ? `/themes/${encodeURIComponent(themeSlug)}?${qs}` : `/themes/${encodeURIComponent(themeSlug)}`;
  }

  function push(href: string) {
    router.push(href);
  }

  // If URL page is out of bounds once we know totalPages, snap it (like your CRA page did).
  useEffect(() => {
    if (page !== safePage) {
      push(makeHref({ page: safePage }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage, totalPages]);

  useEffect(() => {
    let cancelled = false;

    async function loadThemeSets() {
      try {
        setLoading(true);
        setError(null);

        // backend endpoint is limit/offset (not page)
        const offset = (safePage - 1) * PAGE_SIZE;

        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));
        params.set("sort", sort);     // name|year|pieces
        params.set("order", order);   // asc|desc

        // IMPORTANT: this must match backend theme exactly ("City", "Technic", etc.)
        const url = `/api/themes/${encodeURIComponent(themeName)}/sets?${params.toString()}`;

        const resp = await fetch(url, { cache: "no-store" });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Theme sets failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        const items = Array.isArray(data) ? (data as LegoSet[]) : [];

        const totalCount = parseInt(resp.headers.get("x-total-count") || "0", 10);

        if (!cancelled) {
          setSets(items);
          setTotal(Number.isFinite(totalCount) ? totalCount : 0);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Error loading theme sets:", err);
          setError(err?.message || String(err));
          setSets([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadThemeSets();
    return () => {
      cancelled = true;
    };
  }, [themeName, safePage, sort, order]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.25rem 1rem" }}>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "baseline", flexWrap: "wrap" }}>
        <h1 style={{ marginTop: 0, marginBottom: 0 }}>{themeName}</h1>
        <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
          {total ? `${total.toLocaleString()} sets` : ""}
        </div>
      </div>

      <div
        style={{
          marginTop: "0.5rem",
          marginBottom: "0.75rem",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link href="/themes" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to themes
        </Link>

        {/* ✅ Sort: single dropdown (implies direction) */}
        <label style={{ fontSize: 14, color: "#444", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#6b7280" }}>Sort</span>
          <select
            value={sortKey}
            onChange={(e) => push(makeHref({ sortKey: e.target.value, page: 1 }))}
            disabled={loading}
            style={{
              padding: "0.35rem 0.6rem",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            <option value="year_desc">Year (new → old)</option>
            <option value="year_asc">Year (old → new)</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="pieces_desc">Pieces (high → low)</option>
            <option value="pieces_asc">Pieces (low → high)</option>
          </select>
        </label>
      </div>

      {loading && <p>Loading sets…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && !hasResults && (
        <p style={{ color: "#777" }}>No sets found for this theme.</p>
      )}

      {!loading && !error && hasResults && (
        <>
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, 220px)",
              gap: 14,
              justifyContent: "start",
              alignItems: "start",
            }}
          >
            {sets.map((s) => (
              <div key={s.set_num} className="w-[220px]">
                <SetCard set={s as any} token={token || undefined} />
              </div>
            ))}
          </div>

          {/* Pagination (Search-style) */}
          {totalPages > 1 && (
            <div
              style={{
                marginTop: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => push(makeHref({ page: Math.max(1, safePage - 1) }))}
                disabled={safePage <= 1}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  background: safePage <= 1 ? "#f3f4f6" : "white",
                  cursor: safePage <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Prev
              </button>

              {pageItems.map((it, idx) => {
                if (it === "…") {
                  return (
                    <span key={`dots-${idx}`} style={{ padding: "0 0.35rem", color: "#6b7280" }}>
                      …
                    </span>
                  );
                }

                const p = it as number;
                const isActive = p === safePage;

                return (
                  <button
                    key={p}
                    onClick={() => push(makeHref({ page: p }))}
                    disabled={isActive}
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "10px",
                      border: "1px solid #e5e7eb",
                      background: isActive ? "#111827" : "white",
                      color: isActive ? "white" : "#111827",
                      cursor: isActive ? "default" : "pointer",
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => push(makeHref({ page: Math.min(totalPages, safePage + 1) }))}
                disabled={safePage >= totalPages}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  background: safePage >= totalPages ? "#f3f4f6" : "white",
                  cursor: safePage >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
              </div>
    )}
  </>
)}
