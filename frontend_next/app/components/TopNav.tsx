"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers";
import ProfileMenu from "@/app/components/ProfileMenu"; 

function pillClass(active: boolean) {
  return [
    "px-3 py-2 rounded-full text-sm",
    active ? "bg-zinc-900 text-white font-semibold" : "text-zinc-900 hover:bg-zinc-100",
    "dark:text-zinc-50 dark:hover:bg-white/10",
    active ? "dark:bg-zinc-50 dark:text-zinc-900" : "",
  ].join(" ");
}

export default function TopNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { token, me, logout } = useAuth();

  // --- search suggestions ---
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const tRef = useRef<any>(null);

  useEffect(() => {
    const q = searchText.trim();
    if (!q) {
      setSuggestions([]);
      setShow(false);
      setErr(null);
      return;
    }

    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setErr(null);

        // Suggest endpoint via Next API route (proxy)
        const resp = await fetch(`/api/sets/suggest?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!resp.ok) throw new Error(`Suggest failed (${resp.status})`);
        const data = await resp.json();

        setSuggestions(Array.isArray(data) ? data : []);
        setShow(true);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setSuggestions([]);
        setShow(false);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => tRef.current && clearTimeout(tRef.current);
  }, [searchText]);

  function goSearchAll(term?: string) {
    const q = String(term ?? searchText).trim();
    if (!q) return;

    setShow(false);

    router.push(`/search?q=${encodeURIComponent(q)}`);
    setSearchText("");
  }

  function pickSuggestion(s: any) {
    const setNum = s?.set_num;
    if (!setNum) return;
    setShow(false);
    router.push(`/sets/${encodeURIComponent(setNum)}`);
    setSearchText(""); // conf want
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-black/[.08] bg-white/90 backdrop-blur dark:border-white/[.12] dark:bg-black/60">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-6 py-4">
        {/* Left links */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className={pillClass(pathname === "/")}>
            Home
          </Link>
          <Link href="/discover" className={pillClass(pathname.startsWith("/discover"))}>
            Discover
          </Link>
          <Link href="/themes" className={pillClass(pathname.startsWith("/themes"))}>
            Themes
          </Link>
          <Link href="/new" className={pillClass(pathname.startsWith("/new"))}>
            New
          </Link>
          <Link href="/sale" className={pillClass(pathname.startsWith("/sale"))}>
            Sale
          </Link>
          <Link href="/retiring-soon" className={pillClass(pathname.startsWith("/retiring-soon"))}>
            Retiring soon
          </Link>
          <Link href="/collection" className={pillClass(pathname.startsWith("/collection"))}>
            My Collection
          </Link>
        </div>

        {/* Right: search + auth */}
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <input
              value={searchText}
              onChange={(e) => {
                const v = e.target.value;
                setSearchText(v);
                setShow(!!v.trim());
              }}
              // ✅ Enter submits to /search?q=...
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  goSearchAll();
                }
                if (e.key === "Escape") {
                  setShow(false);
                }
              }}
              onFocus={() => {
                if (searchText.trim()) setShow(true);
              }}
              onBlur={() => setTimeout(() => setShow(false), 150)}
              placeholder="Search sets…"
              className="w-[220px] rounded-md border border-black/[.12] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.18] dark:bg-zinc-950"
            />

            {show && (loading || err || suggestions.length > 0 || searchText.trim()) && (
              <div className="absolute left-0 right-0 mt-2 overflow-hidden rounded-xl border border-black/[.10] bg-white shadow-lg dark:border-white/[.12] dark:bg-zinc-950">
                <ul className="max-h-[280px] overflow-auto p-1 text-sm">
                  {loading && <li className="px-3 py-2 text-zinc-500">Searching…</li>}
                  {err && <li className="px-3 py-2 text-red-600">Error: {err}</li>}

                  {!loading && !err && suggestions.length > 0 && (
                    <>
                      <li className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Sets</li>
                      {suggestions.map((s) => (
                        <li
                          key={s.set_num}
                          onMouseDown={() => pickSuggestion(s)}
                          className="cursor-pointer rounded-lg px-3 py-2 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                        >
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-xs text-zinc-500">
                            {s.set_num}
                            {s.year ? ` • ${s.year}` : ""}
                          </div>
                        </li>
                      ))}
                    </>
                  )}

                  {!loading && !err && searchText.trim() && (
                    <li
                      onMouseDown={() => goSearchAll()}
                      className="cursor-pointer rounded-lg px-3 py-2 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                    >
                      Search all sets for <span className="font-semibold">"{searchText.trim()}"</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {!token ? (
          <Link href="/login" className="text-sm font-semibold hover:underline">
            🔐 Login
          </Link>
        ) : (
          <ProfileMenu me={me} onLogout={logout} />
        )}
        </div>
      </div>
    </nav>
  );
}