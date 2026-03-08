// frontend_next/app/components/TopNav.tsx
"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

import { useAuth } from "@/app/providers";
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
  const { isAuthed } = useAuth();

  const links = useMemo(
    () => [
      { href: "/", label: "Home", active: pathname === "/" },
      { href: "/discover", label: "Discover", active: pathname.startsWith("/discover") },
      { href: "/themes", label: "Themes", active: pathname.startsWith("/themes") },
      { href: "/new", label: "New", active: pathname.startsWith("/new") },
      { href: "/coming-soon", label: "Coming soon", active: pathname.startsWith("/coming-soon") },
      { href: "/sale", label: "Sale", active: pathname.startsWith("/sale") },
      { href: "/retiring-soon", label: "Retiring soon", active: pathname.startsWith("/retiring-soon") },
      { href: "/collection", label: "My Collection", active: pathname.startsWith("/collection") },
    ],
    [pathname]
  );

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

  // Escape closes suggestions
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showSuggest) setShowSuggest(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSuggest]);

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
        placeholder="Search sets..."
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-amber-500/20 transition-colors"
      />

      {showSuggest && (loading || suggestErr || suggestions.length > 0 || searchText.trim()) ? (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-lg">
          <ul className="max-h-[280px] overflow-auto p-1 text-sm">
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
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-6 py-3">
        {/* Desktop: pills + search + auth */}
        <div className="flex items-center gap-3">
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

            {!isAuthed ? (
              <Link
                href="/sign-in"
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
                onClick={() => trackLoginCta({ placement: "topnav_desktop" })}
              >
                Sign in
              </Link>
            ) : (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8",
                  },
                }}
              />
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
