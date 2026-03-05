// frontend_next/app/page.tsx
import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import QuickJump from "./components/QuickJump";
import { SITE_NAME } from "@/lib/url";
const HOME_TITLE = `Home | ${SITE_NAME}`;
const HOME_DESC = "Browse LEGO themes and jump to set pages.";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESC,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESC,
    url: "/",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESC,
    images: ["/opengraph-image"],
  },
};

export default function Page() {
  return (
    <>
      <QuickJump />
      <HomeClient />
    </>
  );
}