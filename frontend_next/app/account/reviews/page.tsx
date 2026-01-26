import { Suspense } from "react";
import ReviewsClient from "./ReviewsClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading…</div>}>
      <ReviewsClient />
    </Suspense>
  );
}