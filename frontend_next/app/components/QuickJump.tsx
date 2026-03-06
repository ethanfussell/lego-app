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
    <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="text-sm font-semibold text-zinc-700">
        Quick jump
      </div>
      <div className="mt-2 text-sm text-zinc-500">
        Type a set number and press enter:
      </div>

      <div className="mt-4 flex gap-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 30693-1"
          className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-700 placeholder:text-zinc-400 outline-none transition focus:ring-2 focus:ring-amber-500/20"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go();
            }
          }}
        />
        <button
          type="button"
          className="h-12 shrink-0 rounded-xl bg-amber-500 px-4 text-base font-medium text-black transition-colors hover:bg-amber-400"
          onClick={go}
        >
          Go
        </button>
      </div>

      <div className="mt-3 text-xs text-zinc-500">
        Tip: set numbers usually look like <span className="font-medium text-zinc-500">12345-1</span>.
      </div>
    </div>
  );
}
