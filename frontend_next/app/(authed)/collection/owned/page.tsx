// frontend_next/app/(authed)/collection/owned/page.tsx
import type { Metadata } from "next";
import CollectionOwnedClient from "./CollectionOwnedClient";

export const metadata: Metadata = {
  title: "Owned sets",
};

export default function Page() {
  return <CollectionOwnedClient />;
}