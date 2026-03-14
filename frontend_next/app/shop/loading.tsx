// frontend_next/app/shop/loading.tsx
import { SetGridSkeleton } from "@/app/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6 h-8 w-32 animate-pulse rounded bg-zinc-200" />
      <div className="mb-8 h-4 w-56 animate-pulse rounded bg-zinc-100" />

      {/* Category cards skeleton */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <div className="h-10 w-10 animate-pulse rounded-xl bg-zinc-100" />
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-28 animate-pulse rounded bg-zinc-50" />
          </div>
        ))}
      </div>

      <SetGridSkeleton count={8} />
    </div>
  );
}
