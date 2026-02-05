// app/(authed)/collection/page.tsx
import CollectionClient from "./CollectionClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Collection | LEGO App",
};

export default function CollectionPage() {
  return <CollectionClient />;
}