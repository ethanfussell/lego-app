// app/page.tsx
import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import QuickJump from "./components/QuickJump";

const SITE_NAME = "LEGO App";

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export const metadata: Metadata = {
  title: `Home | ${SITE_NAME}`,
  description: "Browse LEGO themes and jump to set pages.",
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/" },
  openGraph: {
    title: `Home | ${SITE_NAME}`,
    description: "Browse LEGO themes and jump to set pages.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Home | ${SITE_NAME}`,
    description: "Browse LEGO themes and jump to set pages.",
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