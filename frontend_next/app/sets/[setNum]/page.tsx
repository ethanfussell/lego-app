// frontend_next/app/sets/[setNum]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import SetDetailClient from "./SetDetailClient";

const SITE_NAME = "YourSite";

type LegoSet = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string;
  image_url?: string;
  average_rating?: number | null;
  rating_avg?: number | null;
  rating_count?: number;
  description?: string | null;
};

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function isLegoSet(x: unknown): x is LegoSet {
  if (typeof x !== "object" || x === null) return false;
  const sn = (x as { set_num?: unknown }).set_num;
  return typeof sn === "string" && sn.trim() !== "";
}

const fetchSet = cache(async (setNum: string): Promise<LegoSet | null> => {
  const url = `${apiBase()}/sets/${encodeURIComponent(setNum)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const data: unknown = await res.json();
  return isLegoSet(data) ? data : null;
});

type JsonLdObject = Record<string, unknown>;

function buildJsonLd(setDetail: LegoSet): JsonLdObject {
  const avg =
    typeof setDetail.average_rating === "number"
      ? setDetail.average_rating
      : typeof setDetail.rating_avg === "number"
        ? setDetail.rating_avg
        : null;

  const count = typeof setDetail.rating_count === "number" ? setDetail.rating_count : 0;

  const additionalProperty: JsonLdObject[] = [
    ...(setDetail.pieces
      ? [{ "@type": "PropertyValue", name: "Pieces", value: String(setDetail.pieces) }]
      : []),
    ...(setDetail.theme ? [{ "@type": "PropertyValue", name: "Theme", value: String(setDetail.theme) }] : []),
    ...(setDetail.year ? [{ "@type": "PropertyValue", name: "Year", value: String(setDetail.year) }] : []),
  ];

  const jsonLd: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: setDetail.name || setDetail.set_num || "LEGO set",
    sku: setDetail.set_num,
    brand: { "@type": "Brand", name: "LEGO" },
    image: setDetail.image_url ? [setDetail.image_url] : undefined,
    category: "LEGO Sets",
    additionalProperty,
  };

  if (count > 0 && typeof avg === "number") {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: avg,
      ratingCount: count,
      bestRating: 5,
      worstRating: 0,
    };
  }

  return jsonLd;
}

function buildDescription(decodedSetNum: string, data: LegoSet | null): string {
  const name = data?.name || "LEGO Set";
  const pieces = data?.pieces ? `${data.pieces} pieces` : null;
  const year = data?.year ? `from ${data.year}` : null;

  const descParts = [pieces, year].filter(Boolean).join(" · ");
  return descParts
    ? `Details for LEGO set ${decodedSetNum}: ${name}. ${descParts}.`
    : `Details for LEGO set ${decodedSetNum}: ${name}.`;
}

export async function generateMetadata({
  params,
}: {
  params: { setNum: string } | Promise<{ setNum: string }>;
}): Promise<Metadata> {
  const { setNum } = await params; // await works for both value and Promise
  const decoded = decodeURIComponent(setNum);

  const data = await fetchSet(decoded);
  const name = data?.name || "LEGO Set";
  const description = buildDescription(decoded, data);

  const canonicalPath = `/sets/${encodeURIComponent(decoded)}`;

  return {
    title: `LEGO ${decoded} — ${name} | ${SITE_NAME}`,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: `LEGO ${decoded} — ${name} | ${SITE_NAME}`,
      description,
      url: canonicalPath,
      type: "website",
      images: data?.image_url ? [{ url: data.image_url, alt: name }] : undefined,
    },
    twitter: {
      card: data?.image_url ? "summary_large_image" : "summary",
      title: `LEGO ${decoded} — ${name} | ${SITE_NAME}`,
      description,
      images: data?.image_url ? [data.image_url] : undefined,
    },
  };
}

export default async function Page({
  params,
}: {
  params: { setNum: string } | Promise<{ setNum: string }>;
}) {
  const { setNum } = await params;
  const decoded = decodeURIComponent(setNum);

  const data = await fetchSet(decoded);
  if (!data) notFound();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(data)) }} />
      <SetDetailClient setNum={decoded} initialData={data} />
    </>
  );
}