// app/components/SetCard.tsx
"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AddToListMenu from "@/app/components/AddToListMenu";
import { useAuth } from "@/app/providers";
import { apiFetch, APIError } from "@/lib/api";

export type SetLite = {
  set_num: string;
  name?: string;
  year?: number;

  // ✅ backend returns `pieces`; older UI used `num_parts`
  num_parts?: number;
  pieces?: number;

  image_url?: string | null;
  theme?: string;
};

function SmartThumb({
  src,
  alt,
  aspect = "16 / 10",
}: {
  src?: string | null;
  alt: string;
  aspect?: string;
}) {
  return (
    <div className="border-b border-black/[.06] p-2 dark:border-white/[.10]">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-black/[.10] bg-white dark:border-white/[.14] dark:bg-zinc-950"
        style={{ aspectRatio: aspect as any }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">No image</div>
        )}
      </div>
    </div>
  );
}

function isApiStatus(err: unknown, code: number) {
  return err instanceof APIError && err.status === code;
}

export default function SetCard({
  set,
  footer,
  showListMenu = false,

  // optional: if parent already knows (e.g. on owned page), pass these in
  initialOwned = false,
  initialWishlist = false,

  // optional: let parent sync its state if it wants
  onListStateChange,
}: {
  set: SetLite;
  footer?: React.ReactNode;
  showListMenu?: boolean;

  initialOwned?: boolean;
  initialWishlist?: boolean;

  onListStateChange?: (next: { owned: boolean; wishlist: boolean }) => void;
}) {
  const router = useRouter();
  const { token, hydrated } = useAuth();

  const setNum = set?.set_num;
  const name = set?.name || setNum;
  const year = set?.year;

  // ✅ prefer num_parts, fall back to pieces
  const parts =
    typeof set?.num_parts === "number"
      ? set.num_parts
      : typeof set?.pieces === "number"
      ? set.pieces
      : undefined;

  const [owned, setOwned] = useState<boolean>(!!initialOwned);
  const [wishlist, setWishlist] = useState<boolean>(!!initialWishlist);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canUse = useMemo(() => hydrated, [hydrated]);

  async function requireAuth() {
    if (!canUse) return false;
    if (!token) {
      router.push("/login");
      return false;
    }
    return true;
  }

  async function toggleOwned() {
    if (saving) return;
    setErr(null);

    const ok = await requireAuth();
    if (!ok) return;

    const nextOwned = !owned;

    // optimistic UI
    setSaving(true);
    setOwned(nextOwned);

    // ✅ UX + backend rule: if you mark Owned, remove from Wishlist locally too
    const nextWishlist = nextOwned ? false : wishlist;
    if (nextOwned) setWishlist(false);

    try {
      if (nextOwned) {
        await apiFetch("/collections/owned", {
          token,
          method: "POST",
          body: { set_num: setNum },
        });
      } else {
        await apiFetch(`/collections/owned/${encodeURIComponent(setNum)}`, {
          token,
          method: "DELETE",
        });
      }

      onListStateChange?.({ owned: nextOwned, wishlist: nextWishlist });
    } catch (e: any) {
      // rollback
      setOwned(owned);
      setWishlist(wishlist);

      if (isApiStatus(e, 401) || isApiStatus(e, 403)) {
        router.push("/login");
      } else {
        setErr(e?.message || String(e));
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleWishlist() {
    if (saving) return;
    setErr(null);

    const ok = await requireAuth();
    if (!ok) return;

    const nextWishlist = !wishlist;

    // optimistic UI
    setSaving(true);
    setWishlist(nextWishlist);

    try {
      if (nextWishlist) {
        await apiFetch("/collections/wishlist", {
          token,
          method: "POST",
          body: { set_num: setNum },
        });
      } else {
        await apiFetch(`/collections/wishlist/${encodeURIComponent(setNum)}`, {
          token,
          method: "DELETE",
        });
      }

      onListStateChange?.({ owned, wishlist: nextWishlist });
    } catch (e: any) {
      // rollback
      setWishlist(wishlist);

      if (isApiStatus(e, 401) || isApiStatus(e, 403)) {
        router.push("/login");
      } else {
        setErr(e?.message || String(e));
      }
    } finally {
      setSaving(false);
    }
  }

  const autoFooter =
    showListMenu ? (
      <div className="space-y-2">
        <AddToListMenu
          ownedSelected={owned}
          wishlistSelected={wishlist}
          onToggleOwned={toggleOwned}
          onToggleWishlist={toggleWishlist}
        />
        {saving ? <div className="text-xs text-zinc-500">Saving…</div> : null}
        {err ? <div className="text-xs text-red-600">Error: {err}</div> : null}
      </div>
    ) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[.06] bg-white shadow-sm hover:shadow-md dark:border-white/[.10] dark:bg-zinc-950">
      <Link href={`/sets/${encodeURIComponent(setNum)}`} className="block">
        <SmartThumb src={set.image_url} alt={name || setNum} />
        <div className="p-3">
          <div className="text-sm font-semibold leading-snug line-clamp-2">{name}</div>

          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold">{setNum}</span>
            {year ? ` • ${year}` : ""}
          </div>

          {(set.theme || typeof parts === "number") && (
            <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              {set.theme ? <div className="truncate">{set.theme}</div> : null}
              {typeof parts === "number" ? <div>{parts.toLocaleString()} parts</div> : null}
            </div>
          )}
        </div>
      </Link>

      {footer || autoFooter ? (
        <div className="border-t border-black/[.06] p-3 dark:border-white/[.10]">
          {footer ?? autoFooter}
        </div>
      ) : null}
    </div>
  );
}