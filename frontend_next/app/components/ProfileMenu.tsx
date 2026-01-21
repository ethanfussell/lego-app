"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    // Safari fallback
    if ("addEventListener" in mql) mql.addEventListener("change", handler);
    else (mql as any).addListener(handler);

    setIsMobile(mql.matches);

    return () => {
      if ("removeEventListener" in mql) mql.removeEventListener("change", handler);
      else (mql as any).removeListener(handler);
    };
  }, [breakpointPx]);

  return isMobile;
}

export default function ProfileMenu({
  me,
  onLogout,
}: {
  me: any;
  onLogout?: () => void;
}) {
  const router = useRouter();
  const isMobile = useIsMobile(640);

  const username = useMemo(() => {
    return me?.username || me?.email || "Account";
  }, [me]);

  const initials = useMemo(() => {
    const u = String(username || "U").trim();
    return u.slice(0, 1).toUpperCase();
  }, [username]);

  const [open, setOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Close on outside click (desktop dropdown only)
  useEffect(() => {
    if (!open || isMobile) return;

    function onMouseDown(e: MouseEvent) {
      const btn = buttonRef.current;
      const dd = dropdownRef.current;
      if (!btn || !dd) return;

      const target = e.target as Node;
      if (btn.contains(target)) return;
      if (dd.contains(target)) return;

      setOpen(false);
    }

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open, isMobile]);

  function closeThen(fn?: () => void) {
    setOpen(false);
    fn?.();
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 rounded-full border border-black/[.10] bg-white px-3 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
      >
        <div
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-extrabold text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          {initials}
        </div>

        <div className="max-w-[140px] truncate">
          {username}
        </div>

        <span aria-hidden className="text-zinc-500">
          ▾
        </span>
      </button>

      {/* Desktop dropdown */}
      {open && !isMobile && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-56 overflow-hidden rounded-2xl border border-black/[.10] bg-white shadow-lg dark:border-white/[.14] dark:bg-zinc-950"
        >
          <MenuButton label="Account" onClick={() => closeThen(() => router.push("/account"))} />
          <MenuButton label="My Collection" onClick={() => closeThen(() => router.push("/collection"))} />
          <MenuButton
            label="Settings"
            onClick={() => closeThen(() => alert("Settings coming soon."))}
          />
          <Divider />
          <MenuButton
            label="Log out"
            danger
            onClick={() =>
              closeThen(() => {
                onLogout?.();
                router.push("/");
              })
            }
          />
        </div>
      )}

      {/* Mobile sheet */}
      {open && isMobile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex justify-end bg-black/40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="h-full w-[min(92vw,360px)] border-l border-black/[.10] bg-white p-4 shadow-2xl dark:border-white/[.14] dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <div
                aria-hidden
                className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900 text-base font-extrabold text-white dark:bg-zinc-50 dark:text-zinc-900"
              >
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{username}</div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-black/[.10] bg-white px-3 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
              >
                ✕
              </button>
            </div>

            <div className="my-4 h-px bg-black/[.06] dark:bg-white/[.10]" />

            <SheetButton label="Account" onClick={() => closeThen(() => router.push("/account"))} />
            <SheetButton label="My Collection" onClick={() => closeThen(() => router.push("/collection"))} />
            <SheetButton label="Settings" onClick={() => closeThen(() => alert("Settings coming soon."))} />

            <div className="mt-6" />

            <SheetButton
              label="Log out"
              danger
              onClick={() =>
                closeThen(() => {
                  onLogout?.();
                  router.push("/");
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between px-4 py-3 text-left text-sm",
        "hover:bg-black/[.04] dark:hover:bg-white/[.06]",
        danger ? "text-red-700 dark:text-red-300" : "text-zinc-900 dark:text-zinc-50",
        danger ? "font-semibold" : "font-medium",
      ].join(" ")}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function SheetButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "mt-2 w-full rounded-2xl border px-4 py-3 text-left text-base font-semibold",
        "border-black/[.10] bg-white hover:bg-black/[.04]",
        "dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]",
        danger ? "text-red-700 dark:text-red-300" : "text-zinc-900 dark:text-zinc-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-black/[.06] dark:bg-white/[.10]" />;
}