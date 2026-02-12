// frontend_next/app/account/reviews/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import ReviewsClient from "./ReviewsClient";

export const metadata: Metadata = {
  title: "Account reviews",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading…</div>}>
      <ReviewsClient />
    </Suspense>
  );
}