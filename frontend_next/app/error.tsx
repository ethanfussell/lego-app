// frontend_next/app/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console (and Sentry/etc in future)
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-200 bg-white p-10">
        <h1 className="m-0 text-2xl font-semibold text-zinc-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          An unexpected error occurred. You can try again or head back to the
          home page.
        </p>

        {process.env.NODE_ENV !== "production" && error?.message ? (
          <pre className="mt-4 overflow-auto rounded-xl bg-zinc-100 p-4 text-xs text-red-700">
            {error.message}
          </pre>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-transparent px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
