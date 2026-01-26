// frontend_next/app/sets/[setNum]/page.tsx
import type { Metadata } from "next";
import { cache } from "react";
import SetDetailClient from "./SetDetailClient";
import { fetchOffersForSet } from "@/lib/offers";
import OffersSection from "./OffersSection";

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

// Handles Next versions where params may be a Promise (sync dynamic APIs) or a plain object
async function unwrapParams<T extends object>(p: T | Promise<T>): Promise<T> {
  // don't touch p.anything until after we unwrap (avoids Next warning)
  return typeof (p as any)?.then === "function" ? await (p as any) : (p as T);
}

/**
 * OPTIONAL STEP:
 * Use React cache() to dedupe identical fetchSet calls within the same request,
 * so Page() and generateMetadata() won't double-hit the API.
 */
const fetchSet = cache(async (setNum: string): Promise<LegoSet | null> => {
  const url = `${apiBase()}/sets/${encodeURIComponent(setNum)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as LegoSet;
});

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

function buildDescription(decodedSetNum: string, data: LegoSet | null) {
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
  const { setNum } = await unwrapParams(params);
  const decoded = decodeURIComponent(setNum);

  const data = await fetchSet(decoded);

  const name = data?.name || "LEGO Set";
  const description = buildDescription(decoded, data);

  const canonicalPath = `/sets/${encodeURIComponent(decoded)}`;

  return {
    title: `LEGO ${decoded} — ${name} | ${SITE_NAME}`,
    description,

    // Ensures canonical & OG URLs resolve to absolute URLs
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
  const { setNum } = await unwrapParams(params);
  const decoded = decodeURIComponent(setNum);

  // Set detail (server)
  const data = await fetchSet(decoded);

  // Offers (server) — offers are keyed by *plain* set number (no "-1")
  const plainSetNum = decoded.replace(/-1$/, "");
  const offersData = await fetchOffersForSet(plainSetNum);
const offers = Array.isArray(offersData) ? offersData : [];

  return (
    <>
      {data ? (
        <script
          type="application/ld+json"
          // JSON-LD needs to be in the initial HTML
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(data)) }}
        />
      ) : null}

      <SetDetailClient setNum={decoded} initialData={data} />

      {/* Offers section */}
      <OffersSection offers={offers} />
    </>
  );
}