// frontend_next/app/sets/[setNum]/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SetDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SetDetailError]", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-200 bg-white p-10">
        <h1 className="m-0 text-2xl font-semibold text-zinc-900">Error loading set</h1>
        <p className="mt-2 text-sm text-zinc-600">
          We couldn&apos;t load this set&apos;s details. It may be temporarily unavailable.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/search"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-transparent px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            Search sets
          </Link>
        </div>
      </div>
    </div>
  );
}
