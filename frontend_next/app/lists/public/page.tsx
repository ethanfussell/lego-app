import type { Metadata } from "next";
import PublicListsClient from "./PublicListsClient";

const SITE_NAME = "LEGO App";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Public Lists",
    description: "Browse lists shared by the community.",
    alternates: { canonical: "/lists/public" },
  };
}

export default function Page() {
  return <PublicListsClient />;
}