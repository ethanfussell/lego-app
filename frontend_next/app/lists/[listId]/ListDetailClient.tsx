// frontend_next/app/lists/[listId]/ListDetailClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, APIError } from "@/lib/api";
import { useAuth } from "@/app/providers";

type ListDetail = {
  id: number;
  title: string | null;
  description: string | null;
  is_public: boolean;
  owner: string | null;
  owner_username: string | null;
  items_count: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  items?: Array<{ set_num: string }> | null;
  set_nums?: string[] | null;
};

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string;
  image_url?: string | null;
};

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function ListDetailClient({
  listId,
  initialDetail,
  initialSets,
}: {
  listId: string;
  initialDetail: ListDetail;
  initialSets: SetLite[];
}) {
  const { token, hydrated } = useAuth();

  const [detail, setDetail] = useState<ListDetail>(initialDetail);
  const [sets, setSets] = useState<SetLite[]>(initialSets);

  // keep stable; only show warning if refresh fails
  const [warning, setWarning] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const ownerName = useMemo(() => {
    return String(detail.owner_username || detail.owner || "").trim();
  }, [detail.owner_username, detail.owner]);

  const count = useMemo(() => {
    if (typeof detail.items_count === "number") return detail.items_count;
    return sets.length;
  }, [detail.items_count, sets.length]);

  // Optional auth refresh (does NOT blank SSR content)
  useEffect(() => {
    if (!hydrated) return;
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        setWarning(null);

        const d = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(listId)}`, {
          token,
          cache: "no-store",
        });

        if (cancelled || !d) return;
        setDetail((prev) => ({ ...prev, ...d }));
        // sets already SSR-rendered; we leave as-is for now (fast + stable)
      } catch (e: unknown) {
        if (cancelled) return;
        if (e instanceof APIError && (e.status === 401 || e.status === 403)) return;
        setWarning(`Couldn’t refresh right now. Showing cached content.`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, token, listId]);

  async function copyLink() {
    setWarning(null);

    try {
      const url = window.location.href;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt("Copy this link:", url);
      }
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch (e: unknown) {
      setWarning(errorMessage(e) || "Could not copy link.");
    }
  }

  // This component is “extra UI”, not the main content (SSR already handled)
  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {count} set{count === 1 ? "" : "s"}
          {ownerName ? (
            <>
              {" "}
              • by <span className="font-semibold text-zinc-900 dark:text-zinc-50">{ownerName}</span>
            </>
          ) : null}
          {!detail.is_public ? <span className="ml-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Private</span> : null}
        </div>

        {detail.is_public ? (
          <button
            type="button"
            onClick={copyLink}
            className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            {copyState === "copied" ? "Copied!" : "Copy link"}
          </button>
        ) : null}
      </div>

      {warning ? <p className="mt-3 text-xs text-zinc-500">{warning}</p> : null}

      {/* Keep a tiny “SEO sanity” line so you can see SSR is what matters */}
      <div className="mt-4 text-xs text-zinc-500">
        (This box is client-side polish; the set links above are server-rendered for crawl depth.)
      </div>
    </div>
  );
}