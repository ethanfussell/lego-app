// app/page.tsx
import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import QuickJump from "./components/QuickJump";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";
const DESC = "Browse LEGO themes and jump to set pages.";

export const metadata: Metadata = {
  title: { absolute: `Home | ${SITE_NAME}` },
  description: DESC,
  alternates: { canonical: "/" },
  openGraph: {
    title: `Home | ${SITE_NAME}`,
    description: DESC,
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Home | ${SITE_NAME}`,
    description: DESC,
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