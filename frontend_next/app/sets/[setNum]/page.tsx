// frontend_next/app/sets/[setNum]/page.tsx
import type { Metadata } from "next";
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

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

async function fetchSet(setNum: string): Promise<LegoSet | null> {
  const url = `${apiBase()}/api/sets/${encodeURIComponent(setNum)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as LegoSet;
}

function buildJsonLd(setDetail: LegoSet) {
  const avg =
    typeof setDetail.average_rating === "number"
      ? setDetail.average_rating
      : typeof setDetail.rating_avg === "number"
      ? setDetail.rating_avg
      : null;

  const count = typeof setDetail.rating_count === "number" ? setDetail.rating_count : 0;

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: setDetail.name || setDetail.set_num || "LEGO set",
    sku: setDetail.set_num,
    brand: { "@type": "Brand", name: "LEGO" },
    image: setDetail.image_url ? [setDetail.image_url] : undefined,
    category: "LEGO Sets",
    additionalProperty: [
      ...(setDetail.pieces
        ? [{ "@type": "PropertyValue", name: "Pieces", value: String(setDetail.pieces) }]
        : []),
      ...(setDetail.theme
        ? [{ "@type": "PropertyValue", name: "Theme", value: String(setDetail.theme) }]
        : []),
      ...(setDetail.year
        ? [{ "@type": "PropertyValue", name: "Year", value: String(setDetail.year) }]
        : []),
    ],
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ setNum: string }>;
}): Promise<Metadata> {
  const { setNum } = await params;
  const decoded = decodeURIComponent(setNum);
  const data = await fetchSet(decoded);

  const name = data?.name || "LEGO Set";
  const pieces = data?.pieces ? `${data.pieces} pieces` : null;
  const year = data?.year ? `from ${data.year}` : null;

  const descParts = [pieces, year].filter(Boolean).join(" · ");
  const description = descParts
    ? `Details for LEGO set ${decoded}: ${name}. ${descParts}.`
    : `Details for LEGO set ${decoded}: ${name}.`;

  const canonical = `/sets/${encodeURIComponent(decoded)}`;

  return {
    title: `LEGO ${decoded} — ${name} | ${SITE_NAME}`,
    description,

    metadataBase: new URL(siteBase()),
    alternates: { canonical },

    openGraph: {
      title: `LEGO ${decoded} — ${name} | ${SITE_NAME}`,
      description,
      url: canonical,
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
  params: Promise<{ setNum: string }>;
}) {
  const { setNum } = await params;
  const decoded = decodeURIComponent(setNum);

  const data = await fetchSet(decoded);

  return (
    <>
      {data ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(data)) }}
        />
      ) : null}

      <SetDetailClient setNum={decoded} initialData={data} />
    </>
  );
}