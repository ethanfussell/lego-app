import { Suspense } from "react";
import CollectionOwnedClient from "./CollectionOwnedClient";

export default function OwnedPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading…</div>}>
      <CollectionOwnedClient />
    </Suspense>
  );
}