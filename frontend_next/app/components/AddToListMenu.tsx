"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";

type ListSummary = {
  id: number | string;
  title?: string;
  is_public?: boolean;
  is_system?: boolean;
  system_key?: string | null; // "owned" | "wishlist"
};

type ListItemLite = { set_num: string };

type ListDetail = ListSummary & {
  items?: ListItemLite[];
  items_count?: number;
};

type CollectionRow = {
  set_num: string;
};

type Pos = {
  top: number;
  left: number;
  width: number;
  placement: "down" | "up";
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function hasSet(detail: ListDetail | null, setNum: string) {
  const items = Array.isArray(detail?.items) ? detail.items : [];
  return items.some((x) => String(x?.set_num) === String(setNum));
}

export default function AddToListMenu({
  token,
  setNum,
  initialOwnedSelected = false,
  initialWishlistSelected = false,
  enableCustomLists = true,
  fullWidth = false,
  buttonClassName = "",
}: {
  token: string;
  setNum: string;
  initialOwnedSelected?: boolean;
  initialWishlistSelected?: boolean;
  enableCustomLists?: boolean;
  fullWidth?: boolean;
  buttonClassName?: string;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [lists, setLists] = useState<ListSummary[]>([]);
  const [detailById, setDetailById] = useState<Record<string, ListDetail | null>>({});

  const [ownedSelected, setOwnedSelected] = useState<boolean>(initialOwnedSelected);
  const [wishlistSelected, setWishlistSelected] = useState<boolean>(initialWishlistSelected);

  const [pos, setPos] = useState<Pos>({
    top: 0,
    left: 0,
    width: 256,
    placement: "down",
  });

  useEffect(() => setMounted(true), []);
  useEffect(() => setOwnedSelected(initialOwnedSelected), [initialOwnedSelected]);
  useEffect(() => setWishlistSelected(initialWishlistSelected), [initialWishlistSelected]);

  const customLists = useMemo(() => {
    return (lists || []).filter((l) => {
      if (l.is_system) return false;
      const k = String(l.system_key || "").toLowerCase();
      return k !== "owned" && k !== "wishlist";
    });
  }, [lists]);

  function customSelected(listId: string) {
    return hasSet(detailById[listId] || null, setNum);
  }

  function computePosition() {
    const btn = btnRef.current;
    if (!btn) return;

    const r = btn.getBoundingClientRect();
    const menuW = 256;
    const gap = 8;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = r.right - menuW;
    left = clamp(left, 8, vw - menuW - 8);

    const approxMenuH = 360;
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const placeUp = spaceBelow < approxMenuH && spaceAbove > spaceBelow;

    const top = placeUp ? Math.max(8, r.top - gap) : Math.min(vh - 8, r.bottom + gap);

    setPos({
      top,
      left,
      width: menuW,
      placement: placeUp ? "up" : "down",
    });
  }

  useEffect(() => {
    if (!open) return;

    computePosition();

    const onResize = () => computePosition();
    const onScroll = () => computePosition();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // close on outside click + Esc (works with portal)
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    function onPointerDown(e: MouseEvent) {
      const btn = btnRef.current;
      const menu = menuRef.current;
      const t = e.target;

      if (!(t instanceof Node)) return;

      if (btn && btn.contains(t)) return;
      if (menu && menu.contains(t)) return;

      setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  // Load system membership + custom lists (and list details for checkmarks)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!open) return;
      if (!token) return;

      try {
        setLoading(true);
        setErr(null);

        const [ownedRowsU, wishRowsU] = await Promise.all([
          apiFetch<unknown>("/collections/me/owned", { token, cache: "no-store" }),
          apiFetch<unknown>("/collections/me/wishlist", { token, cache: "no-store" }),
        ]);

        if (cancelled) return;

        const ownedArr: CollectionRow[] = Array.isArray(ownedRowsU) ? (ownedRowsU as CollectionRow[]) : [];
        const wishArr: CollectionRow[] = Array.isArray(wishRowsU) ? (wishRowsU as CollectionRow[]) : [];

        const inOwned = ownedArr.some((r) => String(r?.set_num) === String(setNum));
        const inWish = wishArr.some((r) => String(r?.set_num) === String(setNum));

        setOwnedSelected(inOwned);
        setWishlistSelected(inOwned ? false : inWish);

        if (!enableCustomLists) {
          setLists([]);
          setDetailById({});
          return;
        }

        const mineU = await apiFetch<unknown>("/lists/me?include_system=false", { token, cache: "no-store" });
        const arr: ListSummary[] = Array.isArray(mineU) ? (mineU as ListSummary[]) : [];
        if (cancelled) return;

        setLists(arr);

        const entries = await Promise.all(
          arr.map(async (l) => {
            const id = String(l.id);
            try {
              const dU = await apiFetch<unknown>(`/lists/${encodeURIComponent(id)}`, {
                token,
                cache: "no-store",
              });
              const d = (dU && typeof dU === "object") ? (dU as ListDetail) : null;
              return [id, d] as const;
            } catch {
              return [id, null] as const;
            }
          })
        );

        if (cancelled) return;

        const map: Record<string, ListDetail | null> = {};
        for (const [id, d] of entries) map[id] = d;
        setDetailById(map);
      } catch (e: unknown) {
        if (!cancelled) setErr(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, token, setNum, enableCustomLists]);

  async function toggleOwned() {
    if (!token) return;

    const next = !ownedSelected;
    setOwnedSelected(next);
    if (next) setWishlistSelected(false);

    if (next) {
      await apiFetch<unknown>("/collections/owned", { token, method: "POST", body: { set_num: setNum } });
    } else {
      await apiFetch<unknown>(`/collections/owned/${encodeURIComponent(setNum)}`, { token, method: "DELETE" });
    }
  }

  async function toggleWishlist() {
    if (!token) return;

    const next = !wishlistSelected;
    setWishlistSelected(next);
    if (next) setOwnedSelected(false);

    if (next) {
      await apiFetch<unknown>("/collections/wishlist", { token, method: "POST", body: { set_num: setNum } });
    } else {
      await apiFetch<unknown>(`/collections/wishlist/${encodeURIComponent(setNum)}`, { token, method: "DELETE" });
    }
  }

  async function toggleCustom(list: ListSummary) {
    if (!token) return;

    const id = String(list.id);
    const selectedNow = customSelected(id);

    // optimistic update
    setDetailById((prev) => {
      const cur = prev[id] || null;
      const items = Array.isArray(cur?.items) ? [...cur.items] : [];
      const nextItems = selectedNow
        ? items.filter((x) => String(x.set_num) !== String(setNum))
        : [...items, { set_num: setNum }];

      return {
        ...prev,
        [id]: { ...(cur || list), items: nextItems },
      };
    });

    if (!selectedNow) {
      await apiFetch<unknown>(`/lists/${encodeURIComponent(id)}/items`, {
        token,
        method: "POST",
        body: { set_num: setNum },
      });
    } else {
      await apiFetch<unknown>(`/lists/${encodeURIComponent(id)}/items/${encodeURIComponent(setNum)}`, {
        token,
        method: "DELETE",
      });
    }
  }

  const label = ownedSelected ? "In Owned" : wishlistSelected ? "In Wishlist" : "Add to list";
  const disableButtons = loading || !token;

  const menu = (
    <div
      ref={menuRef}
      onMouseDown={(e) => e.stopPropagation()}
      className="z-[9999] w-64 overflow-hidden rounded-2xl border border-black/[.10] bg-white shadow-lg dark:border-white/[.14] dark:bg-zinc-950"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        transform: pos.placement === "up" ? "translateY(-100%)" : undefined,
      }}
    >
      <div className="px-4 py-2 text-xs font-semibold text-zinc-500">
        {loading ? "Loading…" : err ? `Error: ${err}` : "Choose lists"}
      </div>

      <button
        type="button"
        disabled={disableButtons}
        onClick={async () => {
          try {
            await toggleOwned();
            setOpen(false);
          } catch (e: unknown) {
            setErr(errorMessage(e));
          }
        }}
        className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-black/[.04] disabled:opacity-60 dark:hover:bg-white/[.06]"
      >
        <span>Owned</span>
        <span className="text-xs font-semibold text-zinc-500">{ownedSelected ? "✓" : ""}</span>
      </button>

      <button
        type="button"
        disabled={disableButtons}
        onClick={async () => {
          try {
            await toggleWishlist();
            setOpen(false);
          } catch (e: unknown) {
            setErr(errorMessage(e));
          }
        }}
        className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-black/[.04] disabled:opacity-60 dark:hover:bg-white/[.06]"
      >
        <span>Wishlist</span>
        <span className="text-xs font-semibold text-zinc-500">{wishlistSelected ? "✓" : ""}</span>
      </button>

      <div className="my-1 h-px bg-black/[.06] dark:bg-white/[.10]" />

      {!enableCustomLists ? (
        <div className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">Custom lists coming soon.</div>
      ) : customLists.length === 0 ? (
        <div className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">No custom lists yet.</div>
      ) : (
        <div className="max-h-72 overflow-auto">
          {customLists.map((l) => {
            const id = String(l.id);
            const selected = customSelected(id);

            return (
              <button
                key={id}
                type="button"
                disabled={disableButtons}
                onClick={async () => {
                  try {
                    await toggleCustom(l);
                    setOpen(false);
                  } catch (e: unknown) {
                    setErr(errorMessage(e));
                  }
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-black/[.04] disabled:opacity-60 dark:hover:bg-white/[.06]"
                title={l.title || `List ${id}`}
              >
                <span className="truncate">{l.title || `List ${id}`}</span>
                <span className="text-xs font-semibold text-zinc-500">{selected ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setErr(null);
          setOpen((v) => !v);
        }}
        className={[
          fullWidth ? "w-full" : "min-w-0",
          "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full border border-black/[.10] bg-white px-4 text-sm font-semibold hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]",
          buttonClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </button>

      {mounted && open ? createPortal(menu, document.body) : null}
    </>
  );
}