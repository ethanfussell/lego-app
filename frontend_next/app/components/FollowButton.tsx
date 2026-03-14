"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";

type Props = {
  username: string;
  /** Hide the button when viewing your own profile */
  currentUsername?: string | null;
};

export default function FollowButton({ username, currentUsername }: Props) {
  const { token, hydrated } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  // Don't show follow button on own profile
  if (currentUsername && currentUsername === username) return null;

  // Check initial follow status
  useEffect(() => {
    if (!hydrated || !token) return;
    let cancelled = false;

    apiFetch<{ is_following: boolean }>(`/users/${encodeURIComponent(username)}/is-following`, { token })
      .then((res) => {
        if (!cancelled) {
          setIsFollowing(res.is_following);
          setChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });

    return () => { cancelled = true; };
  }, [hydrated, token, username]);

  const toggle = useCallback(async () => {
    if (!token || loading) return;
    setLoading(true);

    try {
      if (isFollowing) {
        await apiFetch(`/users/${encodeURIComponent(username)}/follow`, {
          method: "DELETE",
          token,
        });
        setIsFollowing(false);
      } else {
        await apiFetch(`/users/${encodeURIComponent(username)}/follow`, {
          method: "POST",
          token,
        });
        setIsFollowing(true);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }, [token, loading, isFollowing, username]);

  // Not logged in: don't show button
  if (!hydrated || !token) return null;

  // Still checking
  if (!checked) {
    return (
      <button
        disabled
        className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-semibold text-zinc-400"
      >
        ...
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={
        isFollowing
          ? "rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-semibold text-zinc-700 hover:border-red-300 hover:text-red-600 transition-colors"
          : "rounded-full border border-amber-500 bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
      }
    >
      {loading ? "..." : isFollowing ? "Following" : "Follow"}
    </button>
  );
}
