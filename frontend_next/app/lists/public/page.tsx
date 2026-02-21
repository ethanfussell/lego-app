// frontend_next/app/lists/public/page.tsx
import type { Metadata } from "next";
import PublicListsClient from "./PublicListsClient";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export const revalidate = 3600; // ISR (1 hour)

// static metadata (cache-friendly)
export const metadata: Metadata = {
  title: `Public lists | ${SITE_NAME}`,
  description: "Browse lists shared by the community.",
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/lists/public" },
  openGraph: {
    title: `Public lists | ${SITE_NAME}`,
    description: "Browse lists shared by the community.",
    url: "/lists/public",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Public lists | ${SITE_NAME}`,
    description: "Browse lists shared by the community.",
  },
};

export default function Page() {
  return <PublicListsClient />;
}