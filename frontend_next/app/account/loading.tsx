// frontend_next/app/account/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="animate-pulse space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-zinc-200" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-zinc-200" />
            <div className="h-3 w-24 rounded bg-zinc-100" />
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
