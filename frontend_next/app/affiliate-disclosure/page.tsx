// frontend_next/app/affiliate-disclosure/page.tsx
import type { Metadata } from "next";

const SITE_NAME = "BrickTrack";

export const metadata: Metadata = {
  title: "Affiliate Disclosure",
  description: "Affiliate disclosure for BrickTrack.",
};

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
        Affiliate Disclosure
      </h1>

      <p className="mt-2 text-sm text-zinc-500">Last updated: March 2026</p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-600">
        <p>
          {SITE_NAME} is a participant in the Amazon Services LLC Associates Program, an affiliate
          advertising program designed to provide a means for sites to earn advertising fees by
          advertising and linking to Amazon.com.
        </p>

        <p>
          Some links on {SITE_NAME} are affiliate links. When you click on an affiliate link and make
          a purchase, we may receive a small commission at no additional cost to you. This helps
          support the site and allows us to continue providing free LEGO set tracking, price
          comparison, and community features.
        </p>

        <h2 className="pt-2 text-base font-bold text-zinc-800">What this means for you</h2>

        <ul className="list-disc space-y-1 pl-5">
          <li>You pay the same price whether you use our affiliate link or not.</li>
          <li>We only link to retailers we believe are trustworthy and useful to LEGO fans.</li>
          <li>
            Affiliate relationships never influence our ratings, reviews, or editorial content.
          </li>
          <li>
            We always show you the best available price regardless of whether a retailer has an
            affiliate program with us.
          </li>
        </ul>

        <h2 className="pt-2 text-base font-bold text-zinc-800">Programs we participate in</h2>

        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Amazon Associates</strong> &mdash; Links to Amazon.com product pages and search
            results may contain our affiliate tag.
          </li>
        </ul>

        <p className="pt-2 text-xs text-zinc-500">
          If you have questions about our affiliate relationships, please contact us.
        </p>
      </div>
    </div>
  );
}
