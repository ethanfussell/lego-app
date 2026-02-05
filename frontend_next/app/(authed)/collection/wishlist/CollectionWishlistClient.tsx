"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type ListItem = { set_num: string; added_at?: string; position?: number };

type ListDetail = ListSummary & {
  items?: ListItem[];
};

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  num_parts?: number;
  image_url?: string | null;
  theme?: string;
};

function errorMessage(e: unknown, fallback = "Something went wrong") {
  return e instanceof Error ? e.message : String(e || fallback);
}

function toSetNums(detail: ListDetail | null | undefined): string[] {
  const items = Array.isArray(detail?.items) ? detail.items : [];
  return items.map((x) => String(x?.set_num || "").trim()).filter(Boolean);
}

async function fetchSetsBulk(setNums: string[], token: string): Promise<SetLite[]> {
  const nums = Array.from(new Set(setNums.map((x) => String(x || "").trim()).filter(Boolean)));
  if (nums.length === 0) return [];

  const params = new URLSearchParams();
  params.set("set_nums", nums.join(","));

  const data = await apiFetch<unknown>(`/sets/bulk?${params.toString()}`, {
    token,
    cache: "no-store",
  });

  const arr: SetLite[] = Array.isArray(data)
    ? (data as unknown[]).filter((x): x is SetLite => {
        return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
      })
    : [];

  // keep original order
  const byNum = new Map(arr.map((s) => [s.set_num, s] as const));
  return nums.map((n) => byNum.get(n)).filter((x): x is SetLite => !!x);
}

export default function CollectionWishlistClient() {
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [wishlistDetail, setWishlistDetail] = useState<ListDetail | null>(null);
  const [sets, setSets] = useState<SetLite[]>([]);

  const wishlistSetNums = useMemo(() => new Set(toSetNums(wishlistDetail)), [wishlistDetail]);

  const refresh = useCallback(async () => {
    if (!token) return;

    const mine = await apiFetch<unknown>("/lists/me", { token, cache: "no-store" });
    const arr: ListSummary[] = Array.isArray(mine) ? (mine as ListSummary[]) : [];

    const wish = arr.find((l) => String(l.system_key || "").toLowerCase() === "wishlist");
    if (!wish) {
      setWishlistDetail(null);
      setSets([]);
      return;
    }

    const detail = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(String(wish.id))}`, {
      token,
      cache: "no-store",
    });

    setWishlistDetail(detail ?? null);

    const nums = toSetNums(detail);
    const bulk = await fetchSetsBulk(nums, token);
    setSets(bulk);
  }, [token]);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        await refresh();
      } catch (e: unknown) {
        if (!cancelled) setErr(errorMessage(e, "Failed to load wishlist"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router, refresh]);

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

      {loading ? <p className="mt-6 text-sm">Loading…</p> : null}
      {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      {sets.length === 0 && !loading ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No sets yet.</p>
      ) : (
        <ul className="mt-6 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {sets.map((s) => (
            <li key={s.set_num}>
              <SetCard
                set={s as unknown as React.ComponentProps<typeof SetCard>["set"]}
                footer={
                  token ? (
                    <AddToListMenu
                      token={token}
                      setNum={s.set_num}
                      initialWishlistSelected={wishlistSetNums.has(s.set_num)}
                    />
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}