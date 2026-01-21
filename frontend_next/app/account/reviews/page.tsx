// frontend_next/app/account/reviews/page.tsx
import type { Metadata } from "next";
import ReviewsClient from "./ReviewsClient";

export const metadata: Metadata = {
  title: "My Reviews",
};

export default function Page() {
  return <ReviewsClient />;
}