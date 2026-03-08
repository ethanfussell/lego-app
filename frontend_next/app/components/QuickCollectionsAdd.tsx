// frontend_next/app/components/QuickCollectionsAdd.tsx
"use client";

import React, { useState } from "react";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import { notifyCollectionChanged } from "@/lib/useCollectionStatus";

type Props = {
  onCollectionsChanged?: () => void;
};

type CollectionAddResponse = {
  set_num?: string;
  setNum?: string;
  [k: string]: unknown;
};

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function QuickCollectionsAdd({ onCollectionsChanged }: Props) {
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
    const trimmed = setNum.trim();
    if (!trimmed) {
      setError("Please enter a set number.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const data = await apiFetch<CollectionAddResponse>(`/collections/${type}`, {
        method: "POST",
        token,
        cache: "no-store",
        body: { set_num: trimmed },
      });

      const added = String(data?.set_num || data?.setNum || trimmed);
      setMessage(`Added ${added} to ${type === "owned" ? "Owned" : "Wishlist"}`);
      setSetNum("");

      notifyCollectionChanged();
      onCollectionsChanged?.();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="m-0 text-lg font-semibold">Quick add to your collections</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Type a LEGO set number (like 10305-1) and add it to your Owned or Wishlist collections.
      </p>

      <input
        value={setNum}
        onChange={(e) => setSetNum(e.target.value)}
        placeholder="Set number (e.g. 10305-1)"
        className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleAdd("owned")}
          disabled={loading}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          Owned
        </button>
        <button
          type="button"
          onClick={() => handleAdd("wishlist")}
          disabled={loading}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-60"
        >
          Wishlist
        </button>
      </div>

      {loading ? <p className="mt-3 text-sm">Working…</p> : null}
      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}