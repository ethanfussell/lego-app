// frontend_next/app/components/TopNav.tsx
"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

import { useAuth } from "@/app/providers";
// import NotificationBell from "@/app/components/NotificationBell"; // social feature disabled
// import ThemeToggle from "@/app/components/ThemeToggle"; // dark mode removed
import {
  trackLoginCta,
  trackNavClick,
  trackSearchSubmit,
  trackSearchSuggestionClick,
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
    "px-3 py-2 rounded-full text-sm whitespace-nowrap transition-colors",
    active
      ? "bg-amber-100 text-amber-600 font-semibold"
      : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
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
  const { isAuthed, isAdmin } = useAuth();

  const links = useMemo(
    () => [
      { href: "/", label: "Home", active: pathname === "/" },
      { href: "/discover", label: "Discover", active: pathname.startsWith("/discover") },
      { href: "/themes", label: "Themes", active: pathname.startsWith("/themes") },
      { href: "/shop", label: "Shop", active: pathname.startsWith("/shop") || pathname.startsWith("/new") || pathname.startsWith("/sale") || pathname.startsWith("/retiring-soon") },
      { href: "/blog", label: "Blog", active: pathname.startsWith("/blog") },
      // Feed link disabled (social features deferred)
      // ...(isAuthed ? [{ href: "/feed", label: "Feed", active: pathname.startsWith("/feed") }] : []),
      { href: "/collection", label: "My Collection", active: pathname.startsWith("/collection") },
      ...(isAdmin ? [{ href: "/admin", label: "Admin", active: pathname.startsWith("/admin") }] : []),
    ],
    [pathname, isAdmin]
  );

  // -------------------------
  // Shop dropdown
  // -------------------------
  const [shopOpen, setShopOpen] = useState(false);
  const shopTimeout = useRef<number | null>(null);

  function openShop() {
    if (shopTimeout.current) window.clearTimeout(shopTimeout.current);
    setShopOpen(true);
  }

  function closeShop() {
    shopTimeout.current = window.setTimeout(() => setShopOpen(false), 150);
  }

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
        placement: "topnav_desktop",
        source,
      });

      setShowSuggest(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      router.push(`/search?q=${encodeURIComponent(q)}`);
      setSearchText("");
    },
    [searchText, router]
  );

  const pickSuggestion = useCallback(
    (s: Suggestion) => {
      const setNum = s.set_num;
      const q = searchText.trim();
      if (!setNum) return;

      trackSearchSuggestionClick({
        query: q,
        set_num: setNum,
        placement: "topnav_desktop",
      });

      setShowSuggest(false);
      router.push(`/sets/${encodeURIComponent(setNum)}`);
      setSearchText("");
    },
    [searchText, router]
  );

  // Close suggestions on route change
  useEffect(() => {
    setShowSuggest(false);
    setSearchText("");
  }, [pathname]);

  // Escape closes suggestions
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showSuggest) setShowSuggest(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSuggest]);

  const SearchBox: React.ReactNode = (
    <div className="relative w-full" role="combobox" aria-expanded={showSuggest} aria-haspopup="listbox">
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
        placeholder="Search sets..."
        aria-label="Search LEGO sets"
        aria-autocomplete="list"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-amber-500/20 transition-colors"
      />

      {showSuggest && (loading || suggestErr || suggestions.length > 0 || searchText.trim()) ? (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-lg">
          <ul role="listbox" className="max-h-[280px] overflow-auto p-1 text-sm">
            {loading ? <li className="px-3 py-2 text-zinc-500">Searching...</li> : null}
            {suggestErr ? <li className="px-3 py-2 text-red-400">Error: {suggestErr}</li> : null}

            {!loading && !suggestErr && suggestions.length > 0 ? (
              <>
                <li className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Sets</li>
                {suggestions.map((s) => (
                  <li
                    key={s.set_num}
                    onMouseDown={() => pickSuggestion(s)}
                    className="cursor-pointer rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-100"
                  >
                    <div className="font-semibold">{s.name || "Untitled set"}</div>
                    <div className="text-xs text-zinc-500">
                      {s.set_num}
                      {s.year ? ` \u2022 ${s.year}` : ""}
                    </div>
                  </li>
                ))}
              </>
            ) : null}

            {!loading && !suggestErr && searchText.trim() ? (
              <li
                onMouseDown={() => goSearchAll(undefined, "search_all")}
                className="cursor-pointer rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100"
              >
                Search all sets for <span className="font-semibold text-zinc-800">{`\u201C${searchText.trim()}\u201D`}</span>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur" aria-label="Main navigation">
      <div className="mx-auto w-full max-w-5xl px-6 py-3">
        {/* Desktop: pills + search + auth */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            {links.map((l) =>
              l.href === "/shop" ? (
                /* ── Shop pill + hover dropdown ────────────── */
                <div
                  key={l.href}
                  className="relative"
                  onMouseEnter={openShop}
                  onMouseLeave={closeShop}
                >
                  <Link
                    href="/shop"
                    className={cx(pillClass(l.active), "inline-flex items-center gap-1")}
                    aria-current={l.active ? "page" : undefined}
                    aria-haspopup="true"
                    aria-expanded={shopOpen}
                    onClick={() => trackNavClick({ href: "/shop", label: "Shop", placement: "topnav_desktop" })}
                    onFocus={openShop}
                    onBlur={closeShop}
                  >
                    Shop
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </Link>

                  {shopOpen && (
                    <div
                      role="menu"
                      className="absolute left-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
                    >
                      <Link
                        href="/new"
                        role="menuitem"
                        className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                        onClick={() => { setShopOpen(false); trackNavClick({ href: "/new", label: "New Releases", placement: "topnav_dropdown" }); }}
                        onFocus={openShop}
                        onBlur={closeShop}
                      >
                        New Releases
                      </Link>
                      <Link
                        href="/sale"
                        role="menuitem"
                        className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                        onClick={() => { setShopOpen(false); trackNavClick({ href: "/sale", label: "On Sale", placement: "topnav_dropdown" }); }}
                        onFocus={openShop}
                        onBlur={closeShop}
                      >
                        On Sale
                      </Link>
                      <Link
                        href="/retiring-soon"
                        role="menuitem"
                        className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                        onClick={() => { setShopOpen(false); trackNavClick({ href: "/retiring-soon", label: "Retiring Soon", placement: "topnav_dropdown" }); }}
                        onFocus={openShop}
                        onBlur={closeShop}
                      >
                        Retiring Soon
                      </Link>
                      <div
                        role="menuitem"
                        aria-disabled="true"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 cursor-default"
                      >
                        Upcoming
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                          Soon
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  className={pillClass(l.active)}
                  aria-current={l.active ? "page" : undefined}
                  onClick={() => trackNavClick({ href: l.href, label: l.label, placement: "topnav_desktop" })}
                >
                  {l.label}
                </Link>
              ),
            )}
          </div>

          <div className="ml-auto hidden sm:flex items-center gap-3">
            <div className="w-[260px]">{SearchBox}</div>

            {!isAuthed ? (
              <Link
                href="/sign-in"
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
                onClick={() => trackLoginCta({ placement: "topnav_desktop" })}
              >
                Sign in
              </Link>
            ) : (
              <>
                {/* <NotificationBell /> social feature disabled */}
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8",
                    },
                  }}
                />
              </>
            )}
          </div>

          {/* Mobile: just logo + search + auth (nav is in BottomTabBar) */}
          <div className="sm:hidden flex items-center gap-3 w-full">
            <Link href="/" className="text-base font-bold text-amber-500 whitespace-nowrap">
              BrickTrack
            </Link>
            <div className="flex-1">{SearchBox}</div>
            {!isAuthed ? (
              <Link
                href="/sign-in"
                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 transition-colors whitespace-nowrap"
                onClick={() => trackLoginCta({ placement: "topnav_mobile" })}
              >
                Sign in
              </Link>
            ) : (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-7 h-7",
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
