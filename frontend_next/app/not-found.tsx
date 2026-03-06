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
      <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-200 bg-white p-10">
        <h1 className="m-0 text-2xl font-semibold text-zinc-900">Page not found</h1>
        <p className="mt-2 text-sm text-zinc-600">
          That page doesn’t exist (or the link is outdated).
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/search"
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Search sets
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-transparent px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}