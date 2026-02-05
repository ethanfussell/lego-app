"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);

    const handler = () => {
      setIsMobile(mql.matches);
    };

    // ✅ Set initial value via handler (avoids setState-in-effect lint rule)
    handler();

    if ("addEventListener" in mql) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }

    // Safari fallback
    (mql as MediaQueryList).addListener(handler);
    return () => {
      (mql as MediaQueryList).removeListener(handler);
    };
  }, [breakpointPx]);

  return isMobile;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Divider() {
  return <div className="my-1 h-px bg-black/[.06] dark:bg-white/[.10]" />;
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
      className={cx(
        "flex w-full items-center justify-between px-4 py-3 text-left text-sm",
        "hover:bg-black/[.04] dark:hover:bg-white/[.06]",
        danger ? "text-red-700 font-semibold dark:text-red-300" : "text-zinc-900 font-medium dark:text-zinc-50"
      )}
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
      className={cx(
        "mt-2 w-full rounded-2xl border px-4 py-3 text-left text-base font-semibold",
        "border-black/[.10] bg-white hover:bg-black/[.04]",
        "dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]",
        danger ? "text-red-700 dark:text-red-300" : "text-zinc-900 dark:text-zinc-50"
      )}
    >
      {label}
    </button>
  );
}

type MeUser = {
  username?: string | null;
  email?: string | null;
} | null;

export default function ProfileMenu({ me, onLogout }: { me: MeUser; onLogout?: () => void }) {
  const router = useRouter();
  const isMobile = useIsMobile(640);

  const username = useMemo(() => me?.username || me?.email || "Account", [me]);
  const initials = useMemo(() => String(username || "U").trim().slice(0, 1).toUpperCase(), [username]);

  const [open, setOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus?.();
  };

  function closeThen(fn?: () => void) {
    close();
    fn?.();
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Close on outside click (desktop dropdown only)
  useEffect(() => {
    if (!open || isMobile) return;

    const onMouseDown = (e: MouseEvent) => {
      const btn = buttonRef.current;
      const dd = dropdownRef.current;
      if (!btn || !dd) return;

      const target = e.target as Node;
      if (btn.contains(target)) return;
      if (dd.contains(target)) return;

      setOpen(false);
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open, isMobile]);

  // Lock body scroll on mobile sheet
  useEffect(() => {
    if (!(open && isMobile)) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;

    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [open, isMobile]);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 rounded-full border border-black/[.10] bg-white px-3 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <div
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-extrabold text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          {initials}
        </div>

        <div className="max-w-[140px] truncate">{username}</div>

        <span aria-hidden className="text-zinc-500">
          ▾
        </span>
      </button>

      {/* Desktop dropdown */}
      {open && !isMobile ? (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-56 overflow-hidden rounded-2xl border border-black/[.10] bg-white shadow-lg dark:border-white/[.14] dark:bg-zinc-950"
        >
          <MenuButton label="Account" onClick={() => closeThen(() => router.push("/account"))} />
          <MenuButton label="My Collection" onClick={() => closeThen(() => router.push("/collection"))} />
          <MenuButton label="Settings" onClick={() => closeThen(() => alert("Settings coming soon."))} />
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
      ) : null}

      {/* Mobile sheet (mounted only while open) */}
      {open && isMobile ? (
        <div className="fixed inset-0 z-[70] sm:hidden" role="dialog" aria-modal="true">
          {/* Backdrop (click to close) */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-[min(92vw,360px)] border-l border-black/[.10] bg-white p-4 shadow-2xl dark:border-white/[.14] dark:bg-zinc-950">
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
                onClick={close}
                className="rounded-xl border border-black/[.10] bg-white px-3 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
                aria-label="Close"
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
      ) : null}
    </div>
  );
}