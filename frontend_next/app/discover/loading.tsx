// frontend_next/app/discover/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="animate-pulse space-y-10">
        <div className="h-8 w-40 rounded bg-zinc-200" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-64 rounded-xl bg-zinc-100" />
          ))}
        </div>
        <div className="h-8 w-32 rounded bg-zinc-200" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-64 rounded-xl bg-zinc-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
