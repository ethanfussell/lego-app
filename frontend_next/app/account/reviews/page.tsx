// frontend_next/app/account/reviews/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import ReviewsClient from "./ReviewsClient";

export const metadata: Metadata = {
  title: "My reviews",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse space-y-3"><div className="h-4 w-32 rounded bg-white/[.06]" /><div className="h-3 w-24 rounded bg-white/[.04]" /></div>}>
      <ReviewsClient />
    </Suspense>
  );
}