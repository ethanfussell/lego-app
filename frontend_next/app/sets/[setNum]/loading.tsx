// frontend_next/app/sets/[setNum]/loading.tsx
import { DetailPageSkeleton } from "@/app/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <DetailPageSkeleton />
    </div>
  );
}
