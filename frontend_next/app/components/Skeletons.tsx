// frontend_next/app/components/Skeletons.tsx
import React from "react";
import { SetCardSkeleton } from "./SetCard";

/** Grid of SetCard skeletons — matches the auto-fill grid layout used across pages */
export function SetGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {Array.from({ length: count }, (_, i) => (
        <SetCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Review skeleton for set detail page */
export function ReviewSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-zinc-200" />
        <div className="space-y-1">
          <div className="h-3 w-24 rounded bg-zinc-200" />
          <div className="h-2 w-16 rounded bg-zinc-100" />
        </div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-4 w-4 rounded bg-zinc-100" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-zinc-100" />
        <div className="h-3 w-5/6 rounded bg-zinc-100" />
        <div className="h-3 w-2/3 rounded bg-zinc-100" />
      </div>
    </div>
  );
}

/** Review list skeleton — multiple review cards */
export function ReviewListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <ReviewSkeleton key={i} />
      ))}
    </div>
  );
}

/** Inline row skeleton for list views */
export function ListRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
          <div className="h-10 w-10 rounded bg-zinc-100" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-2/3 rounded bg-zinc-200" />
            <div className="h-2 w-1/3 rounded bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Hero / detail page skeleton */
export function DetailPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 pt-6">
      <div className="mx-auto aspect-[4/3] w-full max-w-md rounded-2xl bg-zinc-100" />
      <div className="space-y-3">
        <div className="h-6 w-3/4 rounded bg-zinc-200" />
        <div className="h-4 w-1/2 rounded bg-zinc-100" />
        <div className="h-4 w-1/3 rounded bg-zinc-100" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="h-16 rounded-xl bg-zinc-100" />
        <div className="h-16 rounded-xl bg-zinc-100" />
        <div className="h-16 rounded-xl bg-zinc-100" />
      </div>
    </div>
  );
}

export { SetCardSkeleton };
