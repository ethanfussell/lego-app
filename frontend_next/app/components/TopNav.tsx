// frontend_next/app/components/TopNav.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import ProfileMenu from "@/app/components/ProfileMenu";
import { createPortal } from "react-dom";

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

/**
 * Notes / fixes vs the messy version:
 * - Suggestions dropdown is a normal dropdown under the input (NOT the mobile menu panel).
 * - Mobile sheet is portaled and ONLY contains nav + auth actions.
 * - No duplicate ids; aria-controls points at the actual sheet id.
 * - Escape closes both mobile sheet + suggestions (optional polish kept).
 * - Close-on-route-change, scroll lock while mounted.
 */
export default function TopNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { token, me, logout } = useAuth();

  // -------------------------
  // Links
  // -------------------------
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
  const [mobileMounted, setMobileMounted] = useState(false); // in DOM
  const [mobileOpen, setMobileOpen] = useState(false); // anim state

  const MOBILE_ANIM_MS = 220;

  function openMobile() {
    setMobileMounted(true);
    requestAnimationFrame(() => setMobileOpen(true));
  }

  function closeMobile() {
    setMobileOpen(false);
    window.setTimeout(() => setMobileMounted(false), MOBILE_ANIM_MS);
  }

  // Close on route change
  useEffect(() => {
    if (!mobileMounted) return;
    closeMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
        const data = await resp.json();

        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggest(true);
      } catch (e: any) {
        setSuggestErr(e?.message || String(e));
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

  function goSearchAll(term?: string) {
    const q = String(term ?? searchText).trim();
    if (!q) return;

    setShowSuggest(false);
    if (mobileMounted) closeMobile();

    router.push(`/search?q=${encodeURIComponent(q)}`);
    setSearchText("");
  }

  function pickSuggestion(s: Suggestion) {
    const setNum = s?.set_num;
    if (!setNum) return;

    setShowSuggest(false);
    if (mobileMounted) closeMobile();

    router.push(`/sets/${encodeURIComponent(setNum)}`);
    setSearchText("");
  }

  // ✅ Optional polish: Escape closes suggestions + mobile sheet
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setShowSuggest(false);
      if (mobileMounted) closeMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileMounted]);

  // shared search input (desktop + mobile)
  const SearchBox = (
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
            goSearchAll();
          }
          if (e.key === "Escape") {
            setShowSuggest(false);
          }
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
                onMouseDown={() => goSearchAll()}
                className="cursor-pointer rounded-lg px-3 py-2 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              >
                Search all sets for <span className="font-semibold">"{searchText.trim()}"</span>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  ) as any;

  return (
    <nav className="sticky top-0 z-50 border-b border-black/[.08] bg-white/90 backdrop-blur dark:border-white/[.12] dark:bg-black/60">
      <div className="mx-auto w-full max-w-5xl px-6 py-3">
        {/* Top row */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
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

          {/* Desktop nav links */}
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={pillClass(l.active)}>
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop right: search + auth */}
          <div className="ml-auto hidden sm:flex items-center gap-3">
            <div className="w-[260px]">{SearchBox}</div>

            {!token ? (
              <Link href="/login" className="text-sm font-semibold hover:underline">
                🔐 Login
              </Link>
            ) : (
              <ProfileMenu me={me} onLogout={logout} />
            )}
          </div>
        </div>

        {/* Mobile second row: search + auth */}
        <div className="mt-3 sm:hidden space-y-3">
          {SearchBox}
          <div className="flex items-center justify-end">
            {!token ? (
              <Link href="/login" className="text-sm font-semibold hover:underline">
                🔐 Login
              </Link>
            ) : (
              <ProfileMenu me={me} onLogout={logout} />
            )}
          </div>
        </div>
      </div>

      {/* Mobile slide-in sheet (ONLY nav + auth) */}
      {mobileMounted && typeof document !== "undefined"
        ? createPortal(
            <div className="sm:hidden fixed inset-0 z-[999]">
              {/* Backdrop */}
              <button
                type="button"
                aria-label="Close menu"
                onClick={closeMobile}
                className={cx(
                  "absolute inset-0 h-full w-full transition-opacity duration-200",
                  mobileOpen ? "bg-black/60 opacity-100 backdrop-blur-[2px]" : "bg-black/0 opacity-0"
                )}
              />

              {/* Panel */}
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
                    onClick={closeMobile}
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
                      onClick={closeMobile}
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
                      onClick={closeMobile}
                    >
                      Log in
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        closeMobile();
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