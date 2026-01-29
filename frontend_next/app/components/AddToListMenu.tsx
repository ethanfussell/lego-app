// frontend_next/app/components/AddToListMenu.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type ListSummary = {
  id: number | string;
  title?: string;
  is_public?: boolean;
  is_system?: boolean;
  system_key?: string | null; // "owned" | "wishlist"
};

type ListDetail = ListSummary & {
  items?: Array<{ set_num: string }>;
};

type CollectionRow = {
  set_num: string;
};

function hasSet(detail: ListDetail | null, setNum: string) {
  const items = Array.isArray(detail?.items) ? detail!.items! : [];
  return items.some((x) => String(x?.set_num) === String(setNum));
}

export default function AddToListMenu({
  token,
  setNum,

  initialOwnedSelected = false,
  initialWishlistSelected = false,

  enableCustomLists = true,
}: {
  token: string;
  setNum: string;
  initialOwnedSelected?: boolean;
  initialWishlistSelected?: boolean;
  enableCustomLists?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [lists, setLists] = useState<ListSummary[]>([]);
  const [detailById, setDetailById] = useState<Record<string, ListDetail | null>>({});

  const [ownedSelected, setOwnedSelected] = useState<boolean>(initialOwnedSelected);
  const [wishlistSelected, setWishlistSelected] = useState<boolean>(initialWishlistSelected);

  useEffect(() => setOwnedSelected(initialOwnedSelected), [initialOwnedSelected]);
  useEffect(() => setWishlistSelected(initialWishlistSelected), [initialWishlistSelected]);

  // close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const customLists = useMemo(() => {
    // We now fetch custom lists only, but keep this safe.
    return (lists || []).filter((l) => {
      if (l.is_system) return false;
      const k = String(l.system_key || "").toLowerCase();
      return k !== "owned" && k !== "wishlist";
    });
  }, [lists]);

  function customSelected(listId: string) {
    const d = detailById[listId] || null;
    return hasSet(d, setNum);
  }

  // Load system membership from /collections/*, and custom lists from /lists/*
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!open) return;
      if (!token) return;

      try {
        setLoading(true);
        setErr(null);

        // 1) system membership (authoritative)
        const [ownedRows, wishRows] = await Promise.all([
          apiFetch<CollectionRow[]>("/collections/me/owned", { token, cache: "no-store" }),
          apiFetch<CollectionRow[]>("/collections/me/wishlist", { token, cache: "no-store" }),
        ]);

        if (cancelled) return;

        const ownedArr = Array.isArray(ownedRows) ? ownedRows : [];
        const wishArr = Array.isArray(wishRows) ? wishRows : [];

        const inOwned = ownedArr.some((r) => String(r?.set_num) === String(setNum));
        const inWish = wishArr.some((r) => String(r?.set_num) === String(setNum));

        // backend makes these mutually exclusive; enforce that in UI too
        setOwnedSelected(inOwned);
        setWishlistSelected(inOwned ? false : inWish);

        // 2) custom lists (optional)
        if (!enableCustomLists) {
          setLists([]);
          setDetailById({});
          return;
        }

        const mine = await apiFetch<ListSummary[]>("/lists/me?include_system=false", {
          token,
          cache: "no-store",
        });
        const arr = Array.isArray(mine) ? mine : [];
        if (cancelled) return;

        setLists(arr);

        // 3) details for checkmarks (custom only)
        const entries = await Promise.all(
          arr.map(async (l) => {
            try {
              const d = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(String(l.id))}`, {
                token,
                cache: "no-store",
              });
              return [String(l.id), d || null] as const;
            } catch {
              return [String(l.id), null] as const;
            }
          })
        );

        if (cancelled) return;

        const map: Record<string, ListDetail | null> = {};
        for (const [id, d] of entries) map[id] = d;
        setDetailById(map);
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
  }, [open, token, setNum, enableCustomLists]);

  // ---------- API actions ----------
  async function toggleOwned() {
    if (!token) return;

    const next = !ownedSelected;
    setOwnedSelected(next);

    // owned + wishlist are mutually exclusive in backend
    if (next) setWishlistSelected(false);

    try {
      if (next) {
        await apiFetch("/collections/owned", { token, method: "POST", body: { set_num: setNum } });
      } else {
        await apiFetch(`/collections/owned/${encodeURIComponent(setNum)}`, { token, method: "DELETE" });
      }
    } catch (e) {
      setOwnedSelected(!next);
      // best-effort restore previous wishlist state (we’ll re-sync on next open anyway)
      if (next) setWishlistSelected(wishlistSelected);
      throw e;
    }
  }

  async function toggleWishlist() {
    if (!token) return;

    const next = !wishlistSelected;
    setWishlistSelected(next);

    // wishlist + owned are mutually exclusive in backend
    if (next) setOwnedSelected(false);

    try {
      if (next) {
        await apiFetch("/collections/wishlist", { token, method: "POST", body: { set_num: setNum } });
      } else {
        await apiFetch(`/collections/wishlist/${encodeURIComponent(setNum)}`, { token, method: "DELETE" });
      }
    } catch (e) {
      setWishlistSelected(!next);
      if (next) setOwnedSelected(ownedSelected);
      throw e;
    }
  }

  async function toggleCustom(list: ListSummary) {
    if (!token) return;

    const id = String(list.id);
    const selectedNow = customSelected(id);

    // optimistic: mutate local detailById
    setDetailById((prev) => {
      const cur = prev[id] || null;
      const items = Array.isArray(cur?.items) ? [...cur!.items!] : [];
      const nextItems = selectedNow
        ? items.filter((x) => String(x.set_num) !== String(setNum))
        : [...items, { set_num: setNum }];

      return {
        ...prev,
        [id]: { ...(cur || list), items: nextItems },
      };
    });

    try {
      if (!selectedNow) {
        await apiFetch(`/lists/${encodeURIComponent(id)}/items`, {
          token,
          method: "POST",
          body: { set_num: setNum },
        });
      } else {
        await apiFetch(`/lists/${encodeURIComponent(id)}/items/${encodeURIComponent(setNum)}`, {
          token,
          method: "DELETE",
        });
      }
    } catch (e) {
      throw e;
    }
  }

  const label = ownedSelected
    ? "In Owned"
    : wishlistSelected
    ? "In Wishlist"
    : "Add to list";

  const disableButtons = loading || !token;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setErr(null);
          setOpen((v) => !v);
        }}
        className="w-full rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
      >
        {label}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl border border-black/[.10] bg-white shadow-lg dark:border-white/[.14] dark:bg-zinc-950"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="px-4 py-2 text-xs font-semibold text-zinc-500">
            {loading ? "Loading…" : err ? `Error: ${err}` : "Choose lists"}
          </div>

          {/* system collections (always available) */}
          <button
            type="button"
            disabled={disableButtons}
            onClick={async () => {
              try {
                await toggleOwned();
                setOpen(false);
              } catch (e: any) {
                setErr(e?.message || String(e));
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
              } catch (e: any) {
                setErr(e?.message || String(e));
              }
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-black/[.04] disabled:opacity-60 dark:hover:bg-white/[.06]"
          >
            <span>Wishlist</span>
            <span className="text-xs font-semibold text-zinc-500">{wishlistSelected ? "✓" : ""}</span>
          </button>

          {/* divider */}
          <div className="my-1 h-px bg-black/[.06] dark:bg-white/[.10]" />

          {/* custom lists */}
          {!enableCustomLists ? (
            <div className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
              Custom lists coming soon.
            </div>
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
                      } catch (e: any) {
                        setErr(e?.message || String(e));
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
      )}
    </div>
  );
}