// frontend_next/app/components/Footer.tsx
import Link from "next/link";
import EmailCapture from "@/app/components/EmailCapture";

const SITE_NAME = "BrickTrack";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-zinc-200 py-10">
      <div className="mx-auto w-full max-w-6xl px-6">
        {/* Email signup */}
        <div className="mb-8">
          <EmailCapture />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} {SITE_NAME}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="hover:text-amber-600 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-amber-600 transition-colors">
              Terms
            </Link>
            <Link href="/affiliate-disclosure" className="hover:text-amber-600 transition-colors">
              Affiliate disclosure
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
