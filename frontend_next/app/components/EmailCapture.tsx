// frontend_next/app/components/EmailCapture.tsx
"use client";

import React, { useState } from "react";
import { apiFetch } from "@/lib/api";

type Props = {
  source?: string;
  onComplete?: (info: { already: boolean }) => void;
};

export default function EmailCapture({ source = "homepage", onComplete }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus("loading");
    setError(null);

    try {
      const res = await apiFetch<{ ok: boolean; already_subscribed?: boolean }>("/email-signups", {
        method: "POST",
        body: { email: trimmed, source },
      });

      const already = Boolean(res?.already_subscribed);

      if (already) setStatus("already");
      else setStatus("success");

      onComplete?.({ already });

      setEmail("");
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    }
  }

  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.14] dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Get updates</div>
          <div className="text-xs text-zinc-500">New features, deals, and retiring soon alerts.</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-10 w-[260px] flex-1 rounded-full border border-black/[.12] bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[.16] dark:bg-zinc-950 dark:focus:ring-white/10"
          disabled={status === "loading"}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="h-10 rounded-full bg-black px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {status === "loading" ? "Saving…" : "Notify me"}
        </button>
      </form>

      {status === "success" ? <p className="mt-2 text-xs text-emerald-600">Saved! 🎉</p> : null}
      {status === "already" ? <p className="mt-2 text-xs text-zinc-500">You’re already on the list.</p> : null}
      {status === "error" ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}