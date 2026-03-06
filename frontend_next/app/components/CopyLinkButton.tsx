"use client";

import React, { useMemo, useState } from "react";

export default function CopyLinkButton({
  enabled,
  className = "",
}: {
  enabled: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);

  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  if (!enabled) return null;

  async function onCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setFallback(false);
        setTimeout(() => setCopied(false), 1200);
        return;
      }
      throw new Error("clipboard_unavailable");
    } catch {
      setFallback(true);
    }
  }

  return (
    <div className={["flex items-center gap-2", className].join(" ")}>
      <button
        type="button"
        onClick={onCopy}
        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>

      {fallback ? (
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 w-[260px] rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-700"
        />
      ) : null}
    </div>
  );
}