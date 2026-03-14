// frontend_next/app/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-amber-500" />
      </div>
    </div>
  );
}
