// frontend_next/app/not-found.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-black/[.08] bg-white p-10 shadow-sm dark:border-white/[.12] dark:bg-black/40">
        <h1 className="m-0 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Page not found</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          That page doesn’t exist (or the link is outdated).
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/search"
            className="inline-flex items-center justify-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-white dark:text-black"
          >
            Search sets
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-black/[.12] bg-white px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:text-zinc-50 dark:hover:bg-white/[.06]"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}