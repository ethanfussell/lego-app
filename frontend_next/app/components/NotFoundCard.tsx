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
      <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm">
        <h1 className="m-0 text-2xl font-semibold text-zinc-900">{title}</h1>

        <p className="mt-2 text-sm text-zinc-600">{message}</p>

        {hint ? (
          <p className="mt-2 text-xs text-zinc-500">{hint}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={primary.href}
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
          >
            {primary.label}
          </Link>

          <Link
            href={secondary.href}
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            {secondary.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
