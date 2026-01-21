"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard from "@/app/components/SetCard";
import AddToListMenu from "@/app/components/AddToListMenu";

type ListDetail = {
  id: number | string;
  title?: string;
  description?: string | null;
  is_public?: boolean;
  is_system?: boolean;
  system_key?: string | null;
  items_count?: number;
  owner?: string;
  items?: Array<{ set_num: string; added_at?: string; position?: number }>;
};

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  num_parts?: number;
  image_url?: string | null;
  theme?: string;
};

function toSetNums(detail: ListDetail | null | undefined) {
  const raw = Array.isArray(detail?.items) ? detail!.items! : [];
  return raw.map((x) => x?.set_num).filter(Boolean);
}

async function fetchSetsBulk(setNums: string[], token?: string) {
  const nums = (Array.isArray(setNums) ? setNums : []).filter(Boolean);
  if (nums.length === 0) return [];

  const params = new URLSearchParams();
  params.set("set_nums", nums.join(","));

  const data = await apiFetch<SetLite[]>(`/sets/bulk?${params.toString()}`, { token });
  const arr = Array.isArray(data) ? data : [];
  const byNum = new Map(arr.map((s) => [s.set_num, s]));
  return nums.map((n) => byNum.get(n)).filter(Boolean) as SetLite[];
}

export default function ListDetailClient() {
  const { token } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const listId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [detail, setDetail] = useState<ListDetail | null>(null);
  const [sets, setSets] = useState<SetLite[]>([]);

  const setNums = useMemo(() => toSetNums(detail), [detail]);
  const setNumSet = useMemo(() => new Set(setNums.map(String)), [setNums]);

  async function refresh() {
    const d = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(listId)}`, {
      token, // optional auth helps for private lists; if not allowed backend returns 404
      cache: "no-store",
    });
    setDetail(d || null);

    const bulk = await fetchSetsBulk(toSetNums(d), token);
    setSets(bulk);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!listId) return;
      try {
        setLoading(true);
        setErr(null);
        await refresh();
        if (cancelled) return;
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, token]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {detail?.title || `List ${listId}`}
          </h1>
          {detail?.description ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{detail.description}</p>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {detail?.items_count ? `${detail.items_count} sets` : "—"}
              {typeof detail?.is_public === "boolean" ? ` • ${detail.is_public ? "Public" : "Private"}` : ""}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Link
            href="/collection"
            className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            Back
          </Link>

          {!token ? (
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Log in
            </button>
          ) : null}
        </div>
      </div>

      {loading && <p className="mt-6 text-sm">Loading…</p>}
      {err && <p className="mt-6 text-sm text-red-600">Error: {err}</p>}

      {sets.length === 0 && !loading ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No sets yet.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 list-none p-0">
          {sets.map((s) => (
            <li key={s.set_num}>
              <SetCard
                set={s}
                footer={
                  token ? (
                    <AddToListMenu
                      token={token}
                      setNum={s.set_num}
                      // for THIS list, you already know if it’s selected: it’s in the list
                      // owned/wishlist will sync when menu opens (or you can preload later)
                    />
                  ) : null
                }
              />
              {/* optional quick remove button for list owner later */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}