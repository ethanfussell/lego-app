// frontend_next/app/(authed)/collection/wishlist/page.tsx
import type { Metadata } from "next";
import CollectionWishlistClient from "./CollectionWishlistClient";

export const metadata: Metadata = {
  title: "Wishlist",
};

export default function Page() {
  return <CollectionWishlistClient />;
}