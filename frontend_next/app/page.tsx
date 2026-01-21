import Link from "next/link";
import type { Metadata } from "next";
import QuickJump from "./components/QuickJump";
import HomeClient from "./HomeClient";

const SITE_NAME = "YourSite";

export const metadata: Metadata = {
  title: `${SITE_NAME} | Home`,
  description: "Browse LEGO themes and jump to set pages.",
};

export default function Page() {
  return <HomeClient />;
};
