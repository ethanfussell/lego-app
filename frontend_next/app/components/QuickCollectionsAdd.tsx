// frontend_next/app/components/QuickCollectionsAdd.tsx
"use client";

import React, { useState } from "react";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";

export default function QuickCollectionsAdd({
  onCollectionsChanged,
}: {
  onCollectionsChanged?: () => void;
}) {
  const { token } = useAuth();
  const [setNum, setSetNum] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAdd(type: "owned" | "wishlist") {
    if (!token) {
      setError("You must be logged in.");
      return;
    }
    if (!setNum.trim()) {
      setError("Please enter a set number.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const data = await apiFetch<any>(`/collections/${type}`, {
        method: "POST",
        token,
        cache: "no-store",
        body: { set_num: setNum.trim() },
      });

      setMessage(`Added ${data?.set_num || setNum.trim()} to ${type === "owned" ? "Owned" : "Wishlist"}`);
      setSetNum("");

      onCollectionsChanged?.();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
      <h2 className="m-0 text-lg font-semibold">Quick add to your collections</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Type a LEGO set number (like 10305-1) and add it to your Owned or Wishlist collections.
      </p>

      <input
        value={setNum}
        onChange={(e) => setSetNum(e.target.value)}
        placeholder="Set number (e.g. 10305-1)"
        className="mt-3 w-full rounded-xl border border-black/[.10] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[.16] dark:bg-transparent"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleAdd("owned")}
          disabled={loading}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          Owned
        </button>
        <button
          type="button"
          onClick={() => handleAdd("wishlist")}
          disabled={loading}
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
        >
          Wishlist
        </button>
      </div>

      {loading ? <p className="mt-3 text-sm">Working…</p> : null}
      {message ? <p className="mt-3 text-sm text-green-700 dark:text-green-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}