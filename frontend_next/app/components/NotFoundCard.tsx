import Link from "next/link";

export default function NotFoundCard(props: {
  title: string;
  message: string;
  hint?: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
}) {
  const { title, message, hint, primary, secondary } = props;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-black/[.08] bg-white p-10 shadow-sm dark:border-white/[.12] dark:bg-black/40">
        <h1 className="m-0 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{message}</p>

        {hint ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={primary.href}
            className="inline-flex items-center justify-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-white dark:text-black"
          >
            {primary.label}
          </Link>

          <Link
            href={secondary.href}
            className="inline-flex items-center justify-center rounded-full border border-black/[.12] bg-white px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:text-zinc-50 dark:hover:bg-white/[.06]"
          >
            {secondary.label}
          </Link>
        </div>
      </div>
    </div>
  );
}