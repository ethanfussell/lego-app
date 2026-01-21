// frontend_next/app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="m-0 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-500">Nothing exists at this URL.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-extrabold text-zinc-900 hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:text-zinc-50 dark:hover:bg-white/[.06]"
        >
          Home
        </Link>
        <Link
          href="/discover/lists"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-extrabold text-zinc-900 hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:text-zinc-50 dark:hover:bg-white/[.06]"
        >
          Discover
        </Link>
        <Link
          href="/search"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-extrabold text-zinc-900 hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:text-zinc-50 dark:hover:bg-white/[.06]"
        >
          Search
        </Link>
        <Link
          href="/account"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-extrabold text-zinc-900 hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:text-zinc-50 dark:hover:bg-white/[.06]"
        >
          My Account
        </Link>
      </div>
    </div>
  );
}