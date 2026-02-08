// frontend_next/app/affiliate-disclosure/page.tsx
import type { Metadata } from "next";

const SITE_NAME = "BrickTrack";

export const metadata: Metadata = {
  title: `Affiliate Disclosure | ${SITE_NAME}`,
  description: "Affiliate disclosure for BrickTrack.",
};

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
        Affiliate Disclosure
      </h1>

      <p className="mt-2 text-sm text-zinc-500">Last updated: 2026-02-01</p>

      <div className="mt-6 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <p>
          Some links on {SITE_NAME} may be affiliate links. This means we may earn a commission if
          you click a link and make a purchase, at no additional cost to you.
        </p>

        <p>
          We only recommend products or retailers we believe may be useful to LEGO fans. Affiliate
          relationships do not influence our ratings, reviews, or editorial content.
        </p>

        <p className="text-xs text-zinc-500">
          This is a placeholder disclosure. Update this page with the specific affiliate programs
          you join (e.g., Amazon Associates) before launch.
        </p>
      </div>
    </div>
  );
}