"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type CreatedList = { id: number | string };

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}

export default function CreateListButton({
  token,
  onCreated,
}: {
  token: string;
  onCreated?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    const t = title.trim();
    if (!t) {
      setErr("Title is required.");
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      const created = await apiFetch<CreatedList>("/lists", {
        token,
        method: "POST",
        body: {
          title: t,
          description: desc.trim() ? desc.trim() : null,
          is_public: false,
        },
      });

      // refresh parent lists
      await onCreated?.();

      setOpen(false);
      setTitle("");
      setDesc("");

      if (created?.id != null) {
        router.push(`/lists/${encodeURIComponent(String(created.id))}`);
      }
    } catch (e: unknown) {
      setErr(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setErr(null);
          setOpen(true);
        }}
        className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
      >
        Create list
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={() => !saving && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-black/[.10] bg-white p-5 shadow-xl dark:border-white/[.14] dark:bg-zinc-950"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-base font-semibold">New list</div>

            <label className="mt-4 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-black/[.10] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-60 dark:border-white/[.14] dark:bg-transparent"
              placeholder="e.g. Castle builds"
              autoFocus
            />

            <label className="mt-4 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Description (optional)
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-black/[.10] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-60 dark:border-white/[.14] dark:bg-transparent"
              placeholder="Short note…"
              rows={3}
            />

            {err ? <div className="mt-3 text-sm text-red-600">Error: {err}</div> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={create}
                className="rounded-full border border-black/[.10] bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-60 dark:border-white/[.16]"
              >
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}