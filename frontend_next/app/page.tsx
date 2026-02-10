// app/page.tsx
import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import QuickJump from "./components/QuickJump";

export const metadata: Metadata = {
  title: "Home",
  description: "Browse LEGO themes and jump to set pages.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Home",
    description: "Browse LEGO themes and jump to set pages.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Home",
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