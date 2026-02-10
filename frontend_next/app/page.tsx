// app/page.tsx
import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import QuickJump from "./components/QuickJump";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

const DESCRIPTION = "Browse LEGO themes and jump to set pages.";

export const metadata: Metadata = {
  title: "Home", // layout template turns this into "LEGO App | Home"
  description: DESCRIPTION,
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/" },
  openGraph: {
    title: `Home | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Home | ${SITE_NAME}`,
    description: DESCRIPTION,
  },
};

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <HomeClient />
      <QuickJump />
    </div>
  );
}