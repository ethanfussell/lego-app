import type { Metadata } from "next";

const SITE_NAME = "BrickTrack";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of service for ${SITE_NAME}.`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
        Terms of Service
      </h1>

      <p className="mt-2 text-sm text-zinc-500">Last updated: 2026-02-01</p>

      <div className="mt-6 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of {SITE_NAME}.
          By using {SITE_NAME}, you agree to these Terms.
        </p>
      </div>

      <Section title="Who we are">
        <p>
          {SITE_NAME} is a LEGO set discovery and tracking app. We provide browsing, search, and
          optional account features like lists, ratings, and reviews.
        </p>
        <p className="text-xs text-zinc-500">
          This is a template. If you operate under a company name, add it here before launch.
        </p>
      </Section>

      <Section title="Accounts">
        <ul className="list-disc pl-5">
          <li>You are responsible for activity on your account.</li>
          <li>Provide accurate information when creating an account.</li>
          <li>Do not share your login credentials.</li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5">
          <li>Use the service to break any laws or violate others’ rights.</li>
          <li>Attempt to access or probe the service in an unauthorized way.</li>
          <li>Abuse, harass, or post unlawful/obscene content.</li>
          <li>Scrape or overload the service (reasonable automated access may be restricted).</li>
        </ul>
      </Section>

      <Section title="User content (lists, ratings, reviews)">
        <ul className="list-disc pl-5">
          <li>You retain ownership of content you post.</li>
          <li>
            You grant {SITE_NAME} a license to host, display, and use your content to operate and
            improve the service.
          </li>
          <li>We may remove content that violates these Terms or applicable law.</li>
        </ul>
      </Section>

      <Section title="Affiliate links">
        <p>
          {SITE_NAME} may include affiliate links. If you click an affiliate link and make a
          purchase, we may earn a commission at no extra cost to you. See the Affiliate Disclosure
          page for details.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>
          The service may rely on third-party providers (hosting, analytics, retailers). Their
          services and sites are governed by their own terms and policies.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          {SITE_NAME} is provided “as is” and “as available”. We do not guarantee the service will be
          uninterrupted or error-free.
        </p>
        <p>
          We try to keep set data accurate, but we don’t guarantee completeness or correctness.
          Prices, availability, and “retiring soon” info may change.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, {SITE_NAME} will not be liable for indirect,
          incidental, special, consequential, or punitive damages, or any loss of profits or data.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          We may suspend or terminate access if you violate these Terms or if needed to protect the
          service or users. You may stop using the service at any time.
        </p>
      </Section>

      <Section title="Changes to these Terms">
        <p>
          We may update these Terms from time to time. If changes are material, we’ll provide a
          reasonable notice (for example, by posting an update in the app).
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these Terms? Contact us at:{" "}
          <span className="font-semibold">support@example.com</span>
        </p>
        <p className="text-xs text-zinc-500">Replace with a real support inbox before launch.</p>
      </Section>
    </div>
  );
}