import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import QuickJump from "./components/QuickJump";

const SITE_NAME = "YourSite";

export const metadata: Metadata = {
  title: `${SITE_NAME} | Home`,
  description: "Browse LEGO themes and jump to set pages.",
};

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <HomeClient />
      <QuickJump />
    </div>
  );
}