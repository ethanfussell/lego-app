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
  review_count?: number | null; // text reviews only (backend)
};

type ReviewLite = {
  id: number;
  set_num: string;
  user: string;
  rating: number | null;
  text: string | null;
  created_at: string;
  updated_at?: string | null;
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

function isReviewLite(x: unknown): x is ReviewLite {
  if (!isRecord(x)) return false;

  const id = x.id;
  const set_num = x.set_num;
  const user = x.user;
  const created_at = x.created_at;

  if (typeof id !== "number" || !Number.isFinite(id)) return false;
  if (typeof set_num !== "string" || !set_num.trim()) return false;
  if (typeof user !== "string" || !user.trim()) return false;
  if (typeof created_at !== "string" || !created_at.trim()) return false;

  return true;
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

const fetchTopTextReviews = cache(async (setNum: string, limit = 10): Promise<ReviewLite[]> => {
  const s = String(setNum ?? "").trim();
  if (!s) return [];

  const url = `${apiBase()}/sets/${encodeURIComponent(s)}/reviews?limit=${encodeURIComponent(String(limit))}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data: unknown = await res.json();
  const arr: unknown[] = Array.isArray(data) ? data : [];

  return arr
    .filter(isReviewLite)
    .filter((r) => typeof r.text === "string" && r.text.trim().length > 0)
    .slice(0, Math.max(0, Math.min(20, limit))); // safety cap
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
  const v = setDetail.review_count;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
}

function canonicalForSet(setNum: string): string {
  const decoded = String(setNum ?? "").trim();
  return `/sets/${encodeURIComponent(decoded)}`;
}

function buildReviewJsonLd(reviews: ReviewLite[]): JsonLdObject[] {
  return reviews.map((r) => {
    const base: JsonLdObject = {
      "@type": "Review",
      author: { "@type": "Person", name: r.user },
      datePublished: r.created_at,
      reviewBody: String(r.text || "").trim(),
    };

    if (typeof r.rating === "number" && Number.isFinite(r.rating)) {
      base.reviewRating = {
        "@type": "Rating",
        ratingValue: Number(r.rating.toFixed(1)),
        bestRating: 5,
        worstRating: 1,
      };
    }

    return base;
  });
}

function buildProductJsonLd(setDetail: LegoSet, reviews: ReviewLite[] = []): JsonLdObject {
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

  // AggregateRating only when real rating info exists
  if (ratingCount > 0 && avg != null) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(avg.toFixed(2)),
      ratingCount,
      ...(reviewCount != null ? { reviewCount } : {}),
      bestRating: 5,
      worstRating: 0,
    };
  }

  // Minimal Review JSON-LD: only real text reviews
  const reviewLd = reviews.length > 0 ? buildReviewJsonLd(reviews) : [];
  if (reviewLd.length > 0) {
    jsonLd.review = reviewLd;
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

function buildBreadcrumbJsonLd(items: Array<{ label: string; href: string }>, baseUrl: string): JsonLdObject {
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
    ...(data.theme
      ? [{ label: String(data.theme), href: `/themes/${encodeURIComponent(String(data.theme))}` }]
      : []),
    { label: decoded, href: canonicalPath },
  ];

  const [topTextReviews] = await Promise.all([fetchTopTextReviews(decoded, 10)]);

  const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbItems, siteBase());
  const productLd = buildProductJsonLd(data, topTextReviews);
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