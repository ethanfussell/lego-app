// frontend_next/app/themes/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6 h-8 w-32 animate-pulse rounded bg-zinc-200" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
