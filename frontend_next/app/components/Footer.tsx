// frontend_next/app/components/Footer.tsx
import Link from "next/link";

const SITE_NAME = "BrickTrack";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-black/[.08] py-10 dark:border-white/[.12]">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <div>© {new Date().getFullYear()} {SITE_NAME}</div>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/affiliate-disclosure" className="hover:underline">
              Affiliate disclosure
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}