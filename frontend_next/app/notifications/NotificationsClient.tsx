// frontend_next/app/notifications/NotificationsClient.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
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
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function notifMessage(n: NotifData): string {
  const name = n.actor?.display_name || n.actor?.username || "Someone";
  switch (n.type) {
    case "new_follower": return `${name} started following you`;
    case "post_liked": return `${name} liked your post`;
    case "post_commented": return `${name} commented on your post`;
    case "review_voted": return `${name} voted on your review`;
    default: return `${name} interacted with you`;
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

function parseNotif(n: unknown): NotifData | null {
  if (!isRecord(n) || typeof n.id !== "number") return null;
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
  return {
    id: n.id,
    type: String(n.type ?? ""),
    target_id: typeof n.target_id === "number" ? n.target_id : null,
    read: n.read === true,
    created_at: typeof n.created_at === "string" ? n.created_at : null,
    actor,
  };
}

export default function NotificationsClient() {
  const { token, hydrated } = useAuth();
  const isLoggedIn = hydrated && !!token;

  const [notifs, setNotifs] = useState<NotifData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadNotifs = useCallback(async (pageNum: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const offset = (pageNum - 1) * 30;
      const data = await apiFetch<unknown>(`/notifications?limit=30&offset=${offset}`, { token });
      if (isRecord(data) && Array.isArray(data.notifications)) {
        const parsed: NotifData[] = [];
        for (const n of data.notifications) {
          const p = parseNotif(n);
          if (p) parsed.push(p);
        }
        setNotifs(pageNum === 1 ? parsed : (prev) => [...prev, ...parsed]);
        setTotal(typeof data.total === "number" ? data.total : 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void loadNotifs(1);
  }, [isLoggedIn, loadNotifs]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      await apiFetch("/notifications/mark-read", { method: "POST", token });
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  }, [token]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    void loadNotifs(next);
  }, [page, loadNotifs]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl px-6 pb-16">
        <h1 className="mt-10 text-2xl font-bold text-zinc-900">Notifications</h1>
        <p className="mt-4 text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-2xl px-6 pb-16">
        <h1 className="mt-10 text-2xl font-bold text-zinc-900">Notifications</h1>
        <p className="mt-4 text-sm text-zinc-500">
          <Link href="/sign-in" className="font-semibold text-amber-600 hover:underline">
            Sign in
          </Link>{" "}
          to see your notifications.
        </p>
      </div>
    );
  }

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl px-6 pb-16">
      <div className="mt-10 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm font-semibold text-amber-600 hover:text-amber-700"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading && notifs.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">Loading notifications...</p>
      )}

      {!loading && notifs.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500">No notifications yet. Follow users and engage with posts to get started!</p>
      )}

      <div className="mt-6 space-y-1">
        {notifs.map((n) => (
          <Link
            key={n.id}
            href={notifLink(n)}
            className={`flex items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-zinc-50 ${
              !n.read ? "bg-amber-50/60" : ""
            }`}
          >
            {n.actor?.avatar_url ? (
              <Image
                src={n.actor.avatar_url}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                {(n.actor?.display_name?.[0] || n.actor?.username?.[0] || "?").toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-800">{notifMessage(n)}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{timeAgo(n.created_at)}</p>
            </div>
            {!n.read && (
              <div className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
            )}
          </Link>
        ))}
      </div>

      {!loading && notifs.length < total && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMore}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
