"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type LegoSet = {
  set_num: string;
  name?: string;
  year?: number;
  theme?: string;
  pieces?: number;
  image_url?: string;
  description?: string | null;
  average_rating?: number | null;
  rating_count?: number;
  rating_avg?: number | null;
};

function prettyThemeHref(themeName: string) {
  return `/themes/${encodeURIComponent(themeName)}`;
}

export default function SetDetailClient({
  setNum,
  initialData,
}: {
  setNum: string;
  initialData?: LegoSet | null;
}) {
  // NOTE: page.tsx is already decoding before passing setNum,
  // but this keeps it safe if you ever pass an encoded value.
  const decodedSetNum = useMemo(() => decodeURIComponent(setNum), [setNum]);

  // If we got server-fetched data, render immediately (no "Loading..." flash).
  const [data, setData] = useState<LegoSet | null>(initialData ?? null);

  // Only show loading on first paint if we *don't* have initial data.
  const [loading, setLoading] = useState<boolean>(initialData === undefined);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr(null);

      // If we already have initialData for this set, don’t refetch.
      // (If you want “always revalidate”, remove this guard.)
      if (initialData !== undefined) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const resp = await fetch(`/api/sets/${encodeURIComponent(decodedSetNum)}`, {
          cache: "no-store",
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Set fetch failed (${resp.status}): ${text}`);
        }

        const json = (await resp.json()) as LegoSet;
        if (!cancelled) setData(json || null);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // important: depend on decodedSetNum and initialData
  }, [decodedSetNum, initialData]);

  if (loading) return <div style={{ padding: "1.25rem" }}>Loading set…</div>;

  if (err) {
    return (
      <div style={{ padding: "1.25rem", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ color: "red", fontWeight: 700 }}>Error: {err}</div>
        <div style={{ marginTop: 10 }}>
          <Link href="/themes" style={{ color: "#2563eb", textDecoration: "none" }}>
            ← Back to themes
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "1.25rem", maxWidth: 1000, margin: "0 auto" }}>
        <div>Set not found.</div>
        <div style={{ marginTop: 10 }}>
          <Link href="/themes" style={{ color: "#2563eb", textDecoration: "none" }}>
            ← Back to themes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.25rem", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <Link href="/themes" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to themes
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            background: "white",
            padding: 10,
            minHeight: 260,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {data.image_url ? (
            <img
              src={data.image_url}
              alt={data.name || data.set_num}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <div style={{ color: "#94a3b8" }}>No image</div>
          )}
        </div>

        <div>
          <h1 style={{ margin: 0 }}>{data.name || "Unknown set"}</h1>
          <div style={{ marginTop: 6, color: "#6b7280", fontWeight: 700 }}>
            {data.set_num}
            {data.year ? ` · ${data.year}` : ""}
            {data.pieces ? ` · ${data.pieces} pcs` : ""}
          </div>

          {data.theme ? (
            <div style={{ marginTop: 10 }}>
              <Link
                href={prettyThemeHref(data.theme)}
                style={{
                  display: "inline-block",
                  padding: "0.35rem 0.8rem",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  textDecoration: "none",
                  color: "#111827",
                  fontWeight: 800,
                }}
              >
                View more {data.theme} sets →
              </Link>
            </div>
          ) : null}

          {data.description ? (
            <p style={{ marginTop: 14, color: "#374151", lineHeight: "1.5em" }}>{data.description}</p>
          ) : (
            <p style={{ marginTop: 14, color: "#6b7280" }}>No description available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}