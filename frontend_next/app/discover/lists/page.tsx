// frontend_next/app/discover/lists/page.tsx
import type { Metadata } from "next";
import PublicListsClient from "./PublicListsClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Discover Lists | LEGO App",
    description: "Browse public LEGO lists from the community.",
    alternates: { canonical: "/discover/lists" },
  };
}

export default function Page() {
  return <PublicListsClient />;
}