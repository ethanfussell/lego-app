// frontend_next/app/components/TopNav.tsx
"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { useAuth } from "@/app/providers";
import ProfileMenu from "@/app/components/ProfileMenu";
import {
  trackLoginCta,
  trackNavClick,
  trackSearchSubmit,
  trackSearchSuggestionClick,
  trackMenuToggle,
} from "@/lib/analytics";

type Suggestion = {
  set_num: string;
  name?: string;
  year?: number;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function pillClass(active: boolean) {
  return cx(
    "px-3 py-2 rounded-full text-sm whitespace-nowrap",
    active ? "bg-zinc-900 text-white font-semibold" : "text-zinc-900 hover:bg-zinc-100",
    "dark:text-zinc-50 dark:hover:bg-white/10",
    active && "dark:bg-zinc-50 dark:text-zinc-900"
  );
}

function mobileLinkClass(active: boolean) {
  return cx(
    "block w-full rounded-xl px-3 py-2 text-sm font-semibold",
    active
      ? "bg-black text-white dark:bg-white dark:text-black"
      : "text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-white/10"
  );
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function isSuggestionArray(x: unknown): x is Suggestion[] {
  if (!Array.isArray(x)) return false;
  return x.every((v) => {
    if (typeof v !== "object" || v === null) return false;
    const sn = (v as { set_num?: unknown }).set_num;
    return typeof sn === "string" && sn.trim().length > 0;
  });
}

export default function TopNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { token, me, logout } = useAuth();
  const isAuthed = !!token;

  const links = useMemo(
    () => [
      { href: "/", label: "Home", active: pathname === "/" },
      { href: "/discover", label: "Discover", active: pathname.startsWith("/discover") },
      { href: "/themes", label: "Themes", active: pathname.startsWith("/themes") },
      { href: "/new", label: "New", active: pathname.startsWith("/new") },
      { href: "/sale", label: "Sale", active: pathname.startsWith("/sale") },
      { href: "/retiring-soon", label: "Retiring soon", active: pathname.startsWith("/retiring-soon") },
      { href: "/collection", label: "My Collection", active: pathname.startsWith("/collection") },
    ],
    [pathname]
  );

  // -------------------------
  // Mobile slide-in menu (portal)
  // -------------------------
  const [mobileMounted, setMobileMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const MOBILE_ANIM_MS = 220;

  const closeFiredRef = useRef(false);

  const openMobile = useCallback(() => {
    closeFiredRef.current = false;
    setMobileMounted(true);
    requestAnimationFrame(() => setMobileOpen(true));

    trackMenuToggle({
      action: "open",
      reason: "hamburger",
      placement: "topnav_mobile",
      path: pathname,
      authed: isAuthed,
    });
  }, [pathname, isAuthed]);

  const closeMobile = useCallback(
    (reason: string) => {
      if (!mobileMounted) return;

      setMobileOpen(false);
      window.setTimeout(() => setMobileMounted(false), MOBILE_ANIM_MS);

      if (!closeFiredRef.current) {
        closeFiredRef.current = true;
        trackMenuToggle({
          action: "close",
          reason,
          placement: "topnav_mobile",
          path: pathname,
          authed: isAuthed,
        });
      }
    },
    [mobileMounted, pathname, isAuthed]
  );

  // Close on route change (only if currently open)
  useEffect(() => {
    if (!mobileMounted) return;
    if (!mobileOpen) return;
    closeMobile("route_change");
  }, [pathname, mobileMounted, mobileOpen, closeMobile]);

  // Lock body scroll while sheet is mounted
  useEffect(() => {
    if (!mobileMounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMounted]);

  // -------------------------
  // Search suggestions
  // -------------------------
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestErr, setSuggestErr] = useState<string | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    const q = searchText.trim();

    if (!q) {
      setSuggestions([]);
      setShowSuggest(false);
      setSuggestErr(null);
      return;
    }

    if (tRef.current) window.clearTimeout(tRef.current);

    tRef.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        setSuggestErr(null);

        const resp = await fetch(`/api/sets/suggest?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!resp.ok) throw new Error(`Suggest failed (${resp.status})`);

        const data: unknown = await resp.json();
        setSuggestions(isSuggestionArray(data) ? data : []);
        setShowSuggest(true);
      } catch (e: unknown) {
        setSuggestErr(errorMessage(e));
        setSuggestions([]);
        setShowSuggest(false);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [searchText]);

  const goSearchAll = useCallback(
    (term?: string, source: "enter" | "search_all" | "chip" = "enter") => {
      const q = String(term ?? searchText).trim();
      if (!q) return;

      trackSearchSubmit({
        query: q,
        placement: mobileMounted ? "topnav_mobile" : "topnav_desktop",
        source,
      });

      setShowSuggest(false);
      if (mobileMounted) closeMobile("nav_click");

      router.push(`/search?q=${encodeURIComponent(q)}`);
      setSearchText("");
    },
    [searchText, mobileMounted, closeMobile, router]
  );

  const pickSuggestion = useCallback(
    (s: Suggestion) => {
      const setNum = s.set_num;
      const q = searchText.trim();
      if (!setNum) return;

      trackSearchSuggestionClick({
        query: q,
        set_num: setNum,
        placement: mobileMounted ? "topnav_mobile" : "topnav_desktop",
      });

      setShowSuggest(false);
      if (mobileMounted) closeMobile("nav_click");

      router.push(`/sets/${encodeURIComponent(setNum)}`);
      setSearchText("");
    },
    [searchText, mobileMounted, closeMobile, router]
  );

  // Escape closes suggestions + mobile sheet
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showSuggest) setShowSuggest(false);
      if (mobileMounted && mobileOpen) closeMobile("escape");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMounted, mobileOpen, showSuggest, closeMobile]);

  const SearchBox: React.ReactNode = (
    <div className="relative w-full">
      <input
        value={searchText}
        onChange={(e) => {
          const v = e.target.value;
          setSearchText(v);
          setShowSuggest(!!v.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            goSearchAll(undefined, "enter");
          }
          if (e.key === "Escape") setShowSuggest(false);
        }}
        onFocus={() => {
          if (searchText.trim()) setShowSuggest(true);
        }}
        onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
        placeholder="Search sets…"
        className="w-full rounded-md border border-black/[.12] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.18] dark:bg-zinc-950"
      />

      {showSuggest && (loading || suggestErr || suggestions.length > 0 || searchText.trim()) ? (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-black/[.10] bg-white shadow-lg dark:border-white/[.12] dark:bg-zinc-950">
          <ul className="max-h-[280px] overflow-auto p-1 text-sm">
            {loading ? <li className="px-3 py-2 text-zinc-500">Searching…</li> : null}
            {suggestErr ? <li className="px-3 py-2 text-red-600">Error: {suggestErr}</li> : null}

            {!loading && !suggestErr && suggestions.length > 0 ? (
              <>
                <li className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Sets</li>
                {suggestions.map((s) => (
                  <li
                    key={s.set_num}
                    onMouseDown={() => pickSuggestion(s)}
                    className="cursor-pointer rounded-lg px-3 py-2 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                  >
                    <div className="font-semibold">{s.name || "Untitled set"}</div>
                    <div className="text-xs text-zinc-500">
                      {s.set_num}
                      {s.year ? ` • ${s.year}` : ""}
                    </div>
                  </li>
                ))}
              </>
            ) : null}

            {!loading && !suggestErr && searchText.trim() ? (
              <li
                onMouseDown={() => goSearchAll(undefined, "search_all")}
                className="cursor-pointer rounded-lg px-3 py-2 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              >
                Search all sets for <span className="font-semibold">{`\u201C${searchText.trim()}\u201D`}</span>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-black/[.08] bg-white/90 backdrop-blur dark:border-white/[.12] dark:bg-black/60">
      <div className="mx-auto w-full max-w-5xl px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openMobile}
            className="sm:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/[.10] bg-white hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="topnav-mobile-sheet"
          >
            ☰
          </button>

          <div className="hidden sm:flex flex-wrap items-center gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={pillClass(l.active)}
                onClick={() => trackNavClick({ href: l.href, label: l.label, placement: "topnav_desktop" })}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto hidden sm:flex items-center gap-3">
            <div className="w-[260px]">{SearchBox}</div>

            {!token ? (
              <Link
                href="/login"
                className="text-sm font-semibold hover:underline"
                onClick={() => trackLoginCta({ placement: "topnav_desktop" })}
              >
                🔐 Login
              </Link>
            ) : (
              <ProfileMenu me={me} onLogout={logout} />
            )}
          </div>
        </div>

        <div className="mt-3 sm:hidden space-y-3">
          {SearchBox}
          <div className="flex items-center justify-end">
            {!token ? (
              <Link
                href="/login"
                className="text-sm font-semibold hover:underline"
                onClick={() => trackLoginCta({ placement: "topnav_mobile" })}
              >
                🔐 Login
              </Link>
            ) : (
              <ProfileMenu me={me} onLogout={logout} />
            )}
          </div>
        </div>
      </div>

      {mobileMounted && typeof document !== "undefined"
        ? createPortal(
            <div className="sm:hidden fixed inset-0 z-[999]">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => closeMobile("backdrop")}
                className={cx(
                  "absolute inset-0 h-full w-full transition-opacity duration-200",
                  mobileOpen ? "bg-black/60 opacity-100 backdrop-blur-[2px]" : "bg-black/0 opacity-0"
                )}
              />

              <div
                id="topnav-mobile-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                className={cx(
                  "absolute left-0 top-0 h-full w-[82%] max-w-[320px]",
                  "border-r border-black/[.08] bg-white p-4 shadow-2xl",
                  "dark:border-white/[.12] dark:bg-zinc-950",
                  "transition-transform duration-200 ease-out will-change-transform",
                  mobileOpen ? "translate-x-0" : "-translate-x-full"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Menu</div>
                  <button
                    type="button"
                    onClick={() => closeMobile("close_button")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/[.10] hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
                    aria-label="Close menu"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 space-y-1">
                  {links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={mobileLinkClass(l.active)}
                      onClick={() => {
                        trackNavClick({ href: l.href, label: l.label, placement: "topnav_mobile_sheet" });
                        closeMobile("nav_click");
                      }}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>

                <div className="mt-6 border-t border-black/[.08] pt-4 text-sm dark:border-white/[.12]">
                  {!token ? (
                    <Link
                      href="/login"
                      className="inline-flex w-full items-center justify-center rounded-full bg-black px-4 py-2 font-semibold text-white hover:opacity-90 dark:bg-white dark:text-black"
                      onClick={() => {
                        trackLoginCta({ placement: "topnav_mobile_sheet" });
                        closeMobile("login_click");
                      }}
                    >
                      Log in
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        closeMobile("logout_click");
                        logout();
                      }}
                      className="inline-flex w-full items-center justify-center rounded-full border border-black/[.10] bg-white px-4 py-2 font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
                    >
                      Log out
                    </button>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </nav>
  );
}