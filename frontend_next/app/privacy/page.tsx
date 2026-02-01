// frontend_next/app/privacy/page.tsx
import type { Metadata } from "next";

const SITE_NAME = "LEGO App";

export const metadata: Metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description: "Privacy policy for LEGO App.",
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
        Privacy Policy
      </h1>

      <p className="mt-2 text-sm text-zinc-500">Last updated: 2026-02-01</p>

      <div className="mt-6 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <p>
          This policy explains what information we collect, how we use it, and the choices you have.
          By using {SITE_NAME}, you agree to this policy.
        </p>
      </div>

      <Section title="Information we collect">
        <p>
          <span className="font-semibold">Account information:</span> If you create an account, we may
          store basic details like a username and email address.
        </p>
        <p>
          <span className="font-semibold">Content you provide:</span> For example, lists you create,
          sets you save, and reviews/ratings you submit.
        </p>
        <p>
          <span className="font-semibold">Usage data:</span> Basic diagnostics and analytics (e.g.
          pages viewed, approximate device/browser info) to help us improve the product.
        </p>
      </Section>

      <Section title="How we use information">
        <p>We use your information to:</p>
        <ul className="list-disc pl-5">
          <li>Provide the core features (login, lists, reviews, search).</li>
          <li>Maintain and improve the service, fix bugs, and prevent abuse.</li>
          <li>Communicate with you about important account or service updates.</li>
        </ul>
      </Section>

      <Section title="Cookies and local storage">
        <p>
          We may use cookies or local storage to keep you signed in and remember preferences. Some
          analytics tools may also use cookies.
        </p>
      </Section>

      <Section title="Sharing">
        <p>
          We do not sell your personal information. We may share information with service providers
          who help us operate the app (e.g., hosting, analytics), but only as needed to provide the
          service.
        </p>
        <p>
          We may disclose information if required by law, or to protect the rights and safety of our
          users and the service.
        </p>
      </Section>

      <Section title="Public content">
        <p>
          If you mark a list as public, it may be visible to anyone with the link. Your username may
          be displayed with public content.
        </p>
      </Section>

      <Section title="Data retention">
        <p>
          We keep information as long as necessary to operate the service, comply with legal
          obligations, and resolve disputes.
        </p>
      </Section>

      <Section title="Your choices">
        <ul className="list-disc pl-5">
          <li>You can edit or delete content you create (where supported).</li>
          <li>You can log out to remove the auth token from your device.</li>
          <li>You can disable cookies in your browser (some features may break).</li>
        </ul>
      </Section>

      <Section title="Contact">
        <p>
          If you have questions about this policy, contact us at:{" "}
          <span className="font-semibold">support@example.com</span>
        </p>
        <p className="text-xs text-zinc-500">
          Replace this email address with a real support inbox before launch.
        </p>
      </Section>
    </div>
  );
}