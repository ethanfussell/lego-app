// frontend_next/app/themes/[themeSlug]/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="rounded-2xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">Theme not found</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          That theme page doesn’t exist (or the slug is invalid).
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/themes"
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Browse themes
          </Link>

          <Link
            href="/discover"
            className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            Browse sets
          </Link>
        </div>
      </div>
    </div>
  );
}