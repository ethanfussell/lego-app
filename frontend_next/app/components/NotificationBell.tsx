"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import { isRecord } from "@/lib/types";

type NotifActor = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type NotifData = {
  id: number;
  type: string;
  target_id: number | null;
  read: boolean;
  created_at: string | null;
  actor: NotifActor | null;
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function notifMessage(n: NotifData): string {
  const name = n.actor?.display_name || n.actor?.username || "Someone";
  switch (n.type) {
    case "new_follower":
      return `${name} followed you`;
    case "post_liked":
      return `${name} liked your post`;
    case "post_commented":
      return `${name} commented on your post`;
    case "review_voted":
      return `${name} voted on your review`;
    default:
      return `${name} interacted with you`;
  }
}

function notifLink(n: NotifData): string {
  switch (n.type) {
    case "new_follower":
      return n.actor ? `/users/${encodeURIComponent(n.actor.username)}` : "/feed";
    case "post_liked":
    case "post_commented":
      return "/feed";
    default:
      return "/notifications";
  }
}

export default function NotificationBell() {
  const { token, hydrated } = useAuth();
  const isLoggedIn = hydrated && !!token;

  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifData[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll unread count every 30s
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const data = await apiFetch<unknown>("/notifications/unread-count", { token });
        if (!cancelled && isRecord(data) && typeof data.unread_count === "number") {
          setUnreadCount(data.unread_count);
        }
      } catch { /* ignore */ }
    };

    void fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isLoggedIn, token]);

  // Load notifications when dropdown opens
  const loadNotifs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<unknown>("/notifications?limit=10", { token });
      if (isRecord(data) && Array.isArray(data.notifications)) {
        const parsed: NotifData[] = [];
        for (const n of data.notifications) {
          if (!isRecord(n) || typeof n.id !== "number") continue;
          let actor: NotifActor | null = null;
          if (isRecord(n.actor)) {
            const a = n.actor as Record<string, unknown>;
            actor = {
              id: typeof a.id === "number" ? a.id : 0,
              username: String(a.username ?? ""),
              display_name: typeof a.display_name === "string" ? a.display_name : null,
              avatar_url: typeof a.avatar_url === "string" ? a.avatar_url : null,
            };
          }
          parsed.push({
            id: n.id,
            type: String(n.type ?? ""),
            target_id: typeof n.target_id === "number" ? n.target_id : null,
            read: n.read === true,
            created_at: typeof n.created_at === "string" ? n.created_at : null,
            actor,
          });
        }
        setNotifs(parsed);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  const toggleDropdown = useCallback(() => {
    if (!open) {
      setOpen(true);
      void loadNotifs();
    } else {
      setOpen(false);
    }
  }, [open, loadNotifs]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      await apiFetch("/notifications/mark-read", { method: "POST", token });
      setUnreadCount(0);
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  }, [token]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!isLoggedIn) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="relative rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-zinc-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-amber-600 hover:text-amber-700"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-auto">
            {loading && notifs.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-zinc-400">Loading...</div>
            )}

            {!loading && notifs.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-zinc-400">No notifications yet</div>
            )}

            {notifs.map((n) => (
              <Link
                key={n.id}
                href={notifLink(n)}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors ${
                  !n.read ? "bg-amber-50/50" : ""
                }`}
              >
                {n.actor?.avatar_url ? (
                  <Image
                    src={n.actor.avatar_url}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                    {(n.actor?.display_name?.[0] || n.actor?.username?.[0] || "?").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-700">{notifMessage(n)}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && (
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                )}
              </Link>
            ))}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-zinc-100 px-4 py-2.5 text-center text-xs font-semibold text-amber-600 hover:bg-zinc-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
