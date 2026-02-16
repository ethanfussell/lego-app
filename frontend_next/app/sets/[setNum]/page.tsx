// frontend_next/app/sets/[setNum]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import SetDetailClient from "./SetDetailClient";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

type LegoSet = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string;
  image_url?: string | null;
  average_rating?: number | null;
  rating_avg?: number | null;
  rating_count?: number | null;
  description?: string | null;
  review_count?: number | null; // ✅ text reviews only (backend)
};

type JsonLdObject = Record<string, unknown>;

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isLegoSet(x: unknown): x is LegoSet {
  if (!isRecord(x)) return false;
  const sn = x.set_num;
  return typeof sn === "string" && sn.trim().length > 0;
}

const fetchSet = cache(async (setNum: string): Promise<LegoSet | null> => {
  const s = String(setNum ?? "").trim();
  if (!s) return null;

  const url = `${apiBase()}/sets/${encodeURIComponent(s)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const data: unknown = await res.json();
  return isLegoSet(data) ? data : null;
});

function pickAvgRating(setDetail: LegoSet): number | null {
  const v =
    typeof setDetail.average_rating === "number"
      ? setDetail.average_rating
      : typeof setDetail.rating_avg === "number"
        ? setDetail.rating_avg
        : null;

  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pickRatingCount(setDetail: LegoSet): number {
  const v = setDetail.rating_count;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function pickReviewCount(setDetail: LegoSet): number | null {
  // Keep separate from ratings:
  // - If backend provides review_count, use it
  // - Otherwise: null (don’t guess)
  const v = setDetail.review_count;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
}

function canonicalForSet(setNum: string): string {
  const decoded = String(setNum ?? "").trim();
  return `/sets/${encodeURIComponent(decoded)}`;
}

function buildProductJsonLd(setDetail: LegoSet): JsonLdObject {
  const avg = pickAvgRating(setDetail);
  const ratingCount = pickRatingCount(setDetail);
  const reviewCount = pickReviewCount(setDetail);

  const base = siteBase();
  const url = new URL(canonicalForSet(setDetail.set_num), base).toString();
  const id = `${url}#product`;

  const additionalProperty: JsonLdObject[] = [
    ...(typeof setDetail.pieces === "number"
      ? [{ "@type": "PropertyValue", name: "Pieces", value: String(setDetail.pieces) }]
      : []),
    ...(typeof setDetail.theme === "string" && setDetail.theme.trim()
      ? [{ "@type": "PropertyValue", name: "Theme", value: setDetail.theme.trim() }]
      : []),
    ...(typeof setDetail.year === "number"
      ? [{ "@type": "PropertyValue", name: "Year", value: String(setDetail.year) }]
      : []),
  ];

  const jsonLd: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": id,
    url,
    name: setDetail.name || setDetail.set_num || "LEGO set",
    sku: setDetail.set_num,
    brand: { "@type": "Brand", name: "LEGO" },
    category: "LEGO Sets",
    additionalProperty,
    ...(setDetail.description ? { description: setDetail.description } : {}),
    ...(setDetail.image_url ? { image: [setDetail.image_url] } : {}),
  };

  // ✅ AggregateRating only when real rating info exists
  if (ratingCount > 0 && avg != null) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(avg.toFixed(2)),
      ratingCount,
      ...(reviewCount != null ? { reviewCount } : {}), // ✅ separate; only include if provided
      bestRating: 5,
      worstRating: 0,
    };
  }

  return jsonLd;
}

function buildWebPageJsonLd(setDetail: LegoSet): JsonLdObject {
  const base = siteBase();
  const url = new URL(canonicalForSet(setDetail.set_num), base).toString();

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: setDetail.name ? `${setDetail.name} (${setDetail.set_num})` : setDetail.set_num,
    mainEntity: { "@id": `${url}#product` },
  };
}

function buildBreadcrumbJsonLd(
  items: Array<{ label: string; href: string }>,
  baseUrl: string
): JsonLdObject {
  const normBase = String(baseUrl || "").replace(/\/+$/, "") || "http://localhost:3000";

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: it.label,
      item: new URL(it.href, normBase).toString(),
    })),
  };
}

function buildDescription(setNum: string, data: LegoSet | null): string {
  const decodedSetNum = String(setNum ?? "").trim();
  const name = data?.name || "LEGO Set";

  const pieces = typeof data?.pieces === "number" ? `${data.pieces} pieces` : null;
  const year = typeof data?.year === "number" ? `from ${data.year}` : null;
  const theme = typeof data?.theme === "string" && data.theme.trim() ? `Theme: ${data.theme.trim()}` : null;

  const facts = [pieces, year, theme].filter(Boolean).join(" · ");
  return facts
    ? `Details for LEGO set ${decodedSetNum}: ${name}. ${facts}.`
    : `Details for LEGO set ${decodedSetNum}: ${name}.`;
}

export async function generateMetadata({
  params,
}: {
  params: { setNum: string } | Promise<{ setNum: string }>;
}): Promise<Metadata> {
  const { setNum } = await params;
  const decoded = decodeURIComponent(String(setNum ?? "").trim());

  const data = await fetchSet(decoded);
  const name = data?.name || "LEGO Set";
  const description = buildDescription(decoded, data);

  const canonicalPath = canonicalForSet(decoded);
  const title = `LEGO ${decoded} — ${name}`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      ...(data?.image_url ? { images: [{ url: data.image_url, alt: name }] } : {}),
    },
    twitter: {
      card: data?.image_url ? "summary_large_image" : "summary",
      title,
      description,
      ...(data?.image_url ? { images: [data.image_url] } : {}),
    },
  };
}

export default async function Page({
  params,
}: {
  params: { setNum: string } | Promise<{ setNum: string }>;
}) {
  const { setNum } = await params;
  const decoded = decodeURIComponent(String(setNum ?? "").trim());

  const data = await fetchSet(decoded);
  if (!data) notFound();

  const canonicalPath = canonicalForSet(decoded);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Themes", href: "/themes" },
    ...(data?.theme
      ? [{ label: String(data.theme), href: `/themes/${encodeURIComponent(String(data.theme))}` }]
      : []),
    { label: decoded, href: canonicalPath },
  ];

  const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbItems, siteBase());
  const productLd = buildProductJsonLd(data);
  const pageLd = buildWebPageJsonLd(data);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <SetDetailClient setNum={decoded} initialData={data} />
    </>
  );
}