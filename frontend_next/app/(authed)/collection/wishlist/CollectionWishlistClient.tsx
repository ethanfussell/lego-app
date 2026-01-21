"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard from "@/app/components/SetCard";
import AddToListMenu from "@/app/components/AddToListMenu";

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
  const nums = (Array.isArray(setNums) ? setNums : []).filter(Boolean);
  if (nums.length === 0) return [];

  const params = new URLSearchParams();
  params.set("set_nums", nums.join(","));

  const data = await apiFetch<SetLite[]>(`/sets/bulk?${params.toString()}`, { token });
  const arr = Array.isArray(data) ? data : [];
  const byNum = new Map(arr.map((s) => [s.set_num, s]));
  return nums.map((n) => byNum.get(n)).filter(Boolean) as SetLite[];
}

export default function CollectionWishlistClient() {
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [wishlistDetail, setWishlistDetail] = useState<ListDetail | null>(null);
  const [sets, setSets] = useState<SetLite[]>([]);

  const wishlistSetNums = useMemo(() => new Set(toSetNums(wishlistDetail).map(String)), [wishlistDetail]);

  async function refresh() {
    if (!token) return;

    const mine = await apiFetch<ListSummary[]>("/lists/me", { token, cache: "no-store" });
    const arr = Array.isArray(mine) ? mine : [];
    const wish = arr.find((l) => String(l.system_key).toLowerCase() === "wishlist");
    if (!wish) {
      setWishlistDetail(null);
      setSets([]);
      return;
    }

    const detail = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(String(wish.id))}`, {
      token,
      cache: "no-store",
    });

    setWishlistDetail(detail || null);

    const nums = toSetNums(detail).slice();
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
          <h1 className="text-2xl font-semibold tracking-tight">Wishlist</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {wishlistDetail?.items_count ? `${wishlistDetail.items_count} sets` : "Sets you want to get."}
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
              <SetCard
                set={s}
                footer={
                  <AddToListMenu
                    token={token}
                    setNum={s.set_num}
                    initialWishlistSelected={wishlistSetNums.has(String(s.set_num))}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}