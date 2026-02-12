// app/(authed)/collection/page.tsx
import type { Metadata } from "next";
import CollectionClient from "./CollectionClient";

export const metadata: Metadata = {
  title: "My Collection",
};

export default function CollectionPage() {
  return <CollectionClient />;
}