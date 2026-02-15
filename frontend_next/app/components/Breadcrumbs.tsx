import Link from "next/link";

export type Crumb = {
  label: string;
  href?: string; // if omitted, renders as current page
};

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items?.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm">
      <ol className="flex flex-wrap items-center gap-2 text-zinc-600 dark:text-zinc-400">
        {items.map((c, idx) => {
          const isLast = idx === items.length - 1;

          return (
            <li key={`${c.label}-${idx}`} className="flex items-center gap-2">
              {c.href && !isLast ? (
                <Link
                  href={c.href}
                  className="font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "font-semibold text-zinc-900 dark:text-zinc-50" : ""}
                >
                  {c.label}
                </span>
              )}

              {!isLast ? <span className="select-none text-zinc-400">›</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}