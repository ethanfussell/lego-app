// app/components/QuickJump.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function QuickJump() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go() {
    const v = value.trim();
    if (!v) return;
    router.push(`/sets/${encodeURIComponent(v)}`);
  }

  return (
    <div className="mt-10 rounded-2xl border border-black/[.06] bg-zinc-50 p-5 dark:border-white/[.10] dark:bg-black">
      <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        Quick jump
      </div>
      <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Type a set number and press enter:
      </div>

      <div className="mt-4 flex gap-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 30693-1"
          className="h-12 w-full rounded-xl border border-black/[.10] bg-white px-4 text-base outline-none transition focus:border-black/30 dark:border-white/[.16] dark:bg-zinc-950 dark:focus:border-white/30"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go();
            }
          }}
        />
        <button
          type="button"
          className="h-12 shrink-0 rounded-xl bg-black px-4 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          onClick={go}
        >
          Go
        </button>
      </div>

      <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
        Tip: set numbers usually look like <span className="font-medium">12345-1</span>.
      </div>
    </div>
  );
}