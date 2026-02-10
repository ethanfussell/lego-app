// app/page.tsx
import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import QuickJump from "./components/QuickJump";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";
const HOME_TITLE = `Home | ${SITE_NAME}`;
const HOME_DESC = "Browse LEGO themes and jump to set pages.";

export const metadata: Metadata = {
  // Force exact <title> (bypasses layout template)
  title: { absolute: HOME_TITLE },
  description: HOME_DESC,
  alternates: { canonical: "/" },

  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESC,
    url: "/",
    type: "website",
  },

  twitter: {
    card: "summary",
    title: HOME_TITLE,
    description: HOME_DESC,
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