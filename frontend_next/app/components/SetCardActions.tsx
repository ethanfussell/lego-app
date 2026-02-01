// frontend_next/app/components/SetCardActions.tsx
"use client";

import Link from "next/link";
import AddToListMenu from "@/app/components/AddToListMenu";

export default function SetCardActions({
  token,
  setNum,
  className = "",
}: {
  token?: string | null;
  setNum: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Shop */}
      <div className="flex-1">
        <Link
          href={`/sets/${encodeURIComponent(setNum)}#shop`}
          className={[
            "inline-flex w-full items-center justify-center",
            "whitespace-nowrap rounded-full border border-black/[.10] bg-white",
            "px-4 py-2 text-sm font-semibold hover:bg-black/[.04]",
            "dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]",
          ].join(" ")}
        >
          Shop
        </Link>
      </div>

      {/* Add to list (or prompt to login) */}
      <div className="flex-1">
        {token ? (
          <AddToListMenu
            token={token}
            setNum={setNum}
            fullWidth
            buttonClassName={["w-full justify-center", "px-4 py-2 text-sm font-semibold"].join(" ")}
          />
        ) : (
          <Link
            href="/login"
            className={[
              "inline-flex w-full items-center justify-center",
              "whitespace-nowrap rounded-full border border-black/[.10] bg-white",
              "px-4 py-2 text-sm font-semibold hover:bg-black/[.04]",
              "dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]",
            ].join(" ")}
          >
            Log in
          </Link>
        )}
      </div>
    </div>
  );
}