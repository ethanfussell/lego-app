// frontend_next/app/themes/[themeSlug]/loading.tsx
import { SetGridSkeleton } from "@/app/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-200" />
      <SetGridSkeleton count={12} />
    </div>
  );
}
