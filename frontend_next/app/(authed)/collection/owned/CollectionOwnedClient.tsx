"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard from "@/app/components/SetCard";

type ListSummary = {
  id: number | string;
  title?: string;
  is_public?: boolean;
  is_system?: boolean;
  system_key?: string | null;
  items_count?: number;
};

type ListDetail = ListSummary & {
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

async function fetchSetsBulk(setNums: string[], token: string) {
  const nums = (Array.isArray(setNums) ? setNums : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  if (nums.length === 0) return [];

  // Backend expects: set_nums=21355-1,4000045-1
  const params = new URLSearchParams();
  params.set("set_nums", nums.join(","));

  const data = await apiFetch<any>(`/sets/bulk?${params.toString()}`, {
    token,
    cache: "no-store",
  });

  const arr = Array.isArray(data) ? data : [];
  if (arr.length === 0) return [];

  // Normalizers to handle "21355" vs "21355-1"
  const toPlain = (n: string) => n.replace(/-\d+$/, "");
  const toDash1 = (n: string) => (/-\d+$/.test(n) ? n : `${n}-1`);

  // Build lookup map with multiple keys per set
  const byKey = new Map<string, any>();
  for (const s of arr) {
    const sn = String(s?.set_num || "").trim();
    if (!sn) continue;
    byKey.set(sn, s);
    byKey.set(toPlain(sn), s);
    byKey.set(toDash1(sn), s);
  }

  // Return sets in the same order as the list items
  return nums
    .map((n) => byKey.get(n) || byKey.get(toPlain(n)) || byKey.get(toDash1(n)))
    .filter(Boolean);
}

export default function CollectionOwnedClient() {
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [ownedDetail, setOwnedDetail] = useState<ListDetail | null>(null);
  const [sets, setSets] = useState<SetLite[]>([]);

  const ownedSetNums = useMemo(() => new Set(toSetNums(ownedDetail).map(String)), [ownedDetail]);

  async function refresh() {
    if (!token) return;

    // find owned list id
    const mine = await apiFetch<ListSummary[]>("/lists/me", { token, cache: "no-store" });
    const arr = Array.isArray(mine) ? mine : [];
    const owned = arr.find((l) => String(l.system_key).toLowerCase() === "owned");
    if (!owned) {
      setOwnedDetail(null);
      setSets([]);
      return;
    }

    const detail = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(String(owned.id))}`, {
      token,
      cache: "no-store",
    });

    setOwnedDetail(detail || null);

    const nums = toSetNums(detail).slice(); // all
    const bulk = await fetchSetsBulk(nums, token);
    setSets(bulk);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) {
        router.push("/login");
        return;
      }

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
  }, [token]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Owned</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {ownedDetail?.items_count ? `${ownedDetail.items_count} sets` : "Your owned LEGO sets."}
          </p>
        </div>

        <Link
          href="/collection"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
        >
          Back
        </Link>
      </div>

      {loading && <p className="mt-6 text-sm">Loading…</p>}
      {err && <p className="mt-6 text-sm text-red-600">Error: {err}</p>}

      {sets.length === 0 && !loading ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No sets yet.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 list-none p-0">
          {sets.map((s) => (
            <li key={s.set_num}>
              <SetCard set={s} variant="owned" token={token}/>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}