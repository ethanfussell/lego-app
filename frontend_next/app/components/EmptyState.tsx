// frontend_next/app/components/EmptyState.tsx
import React from "react";
import Link from "next/link";

type Props = {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
};

/** Default empty-box SVG icon */
function DefaultIcon() {
  return (
    <svg
      className="h-12 w-12 text-zinc-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </svg>
  );
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4">{icon ?? <DefaultIcon />}</div>
      <h3 className="text-lg font-semibold text-zinc-600">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Link
              href={action.href}
              className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
            >
              {action.label} &rarr;
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="inline-flex items-center rounded-full border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
