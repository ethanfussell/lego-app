// frontend_next/app/feed/SocialFeedClient.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import { isRecord } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PostUser = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type LinkedSet = {
  set_num: string;
  name: string;
  image_url: string | null;
  theme: string | null;
  pieces: number | null;
  year: number | null;
};

type PostData = {
  id: number;
  text: string | null;
  image_url: string | null;
  linked_set_num: string | null;
  created_at: string | null;
  updated_at: string | null;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  user: PostUser;
  linked_set?: LinkedSet | null;
};

type CommentData = {
  id: number;
  post_id: number;
  text: string;
  created_at: string | null;
  user: PostUser;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coercePost(x: unknown): PostData | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== "number") return null;
  if (!isRecord(x.user)) return null;

  const user = x.user as Record<string, unknown>;
  let linked_set: LinkedSet | null = null;
  if (isRecord(x.linked_set)) {
    const ls = x.linked_set as Record<string, unknown>;
    linked_set = {
      set_num: String(ls.set_num ?? ""),
      name: String(ls.name ?? ""),
      image_url: typeof ls.image_url === "string" ? ls.image_url : null,
      theme: typeof ls.theme === "string" ? ls.theme : null,
      pieces: typeof ls.pieces === "number" ? ls.pieces : null,
      year: typeof ls.year === "number" ? ls.year : null,
    };
  }

  return {
    id: x.id,
    text: typeof x.text === "string" ? x.text : null,
    image_url: typeof x.image_url === "string" ? x.image_url : null,
    linked_set_num: typeof x.linked_set_num === "string" ? x.linked_set_num : null,
    created_at: typeof x.created_at === "string" ? x.created_at : null,
    updated_at: typeof x.updated_at === "string" ? x.updated_at : null,
    likes_count: typeof x.likes_count === "number" ? x.likes_count : 0,
    comments_count: typeof x.comments_count === "number" ? x.comments_count : 0,
    liked_by_me: x.liked_by_me === true,
    user: {
      id: typeof user.id === "number" ? user.id : 0,
      username: String(user.username ?? ""),
      display_name: typeof user.display_name === "string" ? user.display_name : null,
      avatar_url: typeof user.avatar_url === "string" ? user.avatar_url : null,
    },
    linked_set,
  };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Post Card
// ---------------------------------------------------------------------------

function UserAvatar({ user, size = 40 }: { user: PostUser; size?: number }) {
  const initial = (user.display_name?.[0] || user.username[0] || "?").toUpperCase();
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-amber-100 font-bold text-amber-700"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {user.avatar_url ? (
        <Image src={user.avatar_url} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

function PostCard({
  post,
  token,
  currentUserId,
  onDelete,
}: {
  post: PostData;
  token: string;
  currentUserId: number | null;
  onDelete: (id: number) => void;
}) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(post.comments_count);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  const toggleLike = useCallback(async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await apiFetch(`/posts/${post.id}/like`, { method: "DELETE", token });
        setLiked(false);
        setLikesCount((c) => Math.max(0, c - 1));
      } else {
        await apiFetch(`/posts/${post.id}/like`, { method: "POST", token });
        setLiked(true);
        setLikesCount((c) => c + 1);
      }
    } catch { /* ignore */ }
    setLikeLoading(false);
  }, [liked, likeLoading, post.id, token]);

  const loadComments = useCallback(async () => {
    try {
      const data = await apiFetch<unknown>(`/posts/${post.id}/comments?limit=50`, { token });
      if (isRecord(data) && Array.isArray(data.comments)) {
        const parsed: CommentData[] = [];
        for (const c of data.comments) {
          if (!isRecord(c) || typeof c.id !== "number") continue;
          const u = isRecord(c.user) ? c.user as Record<string, unknown> : {};
          parsed.push({
            id: c.id,
            post_id: typeof c.post_id === "number" ? c.post_id : post.id,
            text: String(c.text ?? ""),
            created_at: typeof c.created_at === "string" ? c.created_at : null,
            user: {
              id: typeof u.id === "number" ? u.id : 0,
              username: String(u.username ?? ""),
              display_name: typeof u.display_name === "string" ? u.display_name : null,
              avatar_url: typeof u.avatar_url === "string" ? u.avatar_url : null,
            },
          });
        }
        setComments(parsed);
        setCommentsTotal(typeof data.total === "number" ? data.total : parsed.length);
      }
    } catch { /* ignore */ }
  }, [post.id, token]);

  const toggleComments = useCallback(() => {
    if (!showComments) {
      setShowComments(true);
      void loadComments();
    } else {
      setShowComments(false);
    }
  }, [showComments, loadComments]);

  const submitComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text || commentLoading) return;
    setCommentLoading(true);
    try {
      await apiFetch(`/posts/${post.id}/comments`, {
        method: "POST",
        token,
        body: { text },
      });
      setCommentText("");
      void loadComments();
      setCommentsTotal((c) => c + 1);
    } catch { /* ignore */ }
    setCommentLoading(false);
  }, [commentText, commentLoading, post.id, token, loadComments]);

  const handleDelete = useCallback(async () => {
    try {
      await apiFetch(`/posts/${post.id}`, { method: "DELETE", token });
      onDelete(post.id);
    } catch { /* ignore */ }
  }, [post.id, token, onDelete]);

  const isOwner = currentUserId === post.user.id;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/users/${encodeURIComponent(post.user.username)}`}>
          <UserAvatar user={post.user} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/users/${encodeURIComponent(post.user.username)}`}
            className="text-sm font-semibold text-zinc-900 hover:text-amber-600"
          >
            {post.user.display_name || post.user.username}
          </Link>
          <div className="text-xs text-zinc-400">
            @{post.user.username} &middot; {timeAgo(post.created_at)}
          </div>
        </div>
        {isOwner && (
          <button
            onClick={handleDelete}
            className="text-xs text-zinc-400 hover:text-red-500"
            title="Delete post"
          >
            Delete
          </button>
        )}
      </div>

      {/* Text */}
      {post.text && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-800">{post.text}</p>
      )}

      {/* Linked set */}
      {post.linked_set && (
        <Link
          href={`/sets/${encodeURIComponent(post.linked_set.set_num)}`}
          className="mt-3 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 hover:border-zinc-300"
        >
          {post.linked_set.image_url ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white">
              <Image
                src={post.linked_set.image_url}
                alt=""
                fill
                sizes="64px"
                className="object-contain"
              />
            </div>
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-zinc-200 text-xs text-zinc-500">
              No img
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900">{post.linked_set.name}</div>
            <div className="text-xs text-zinc-500">
              {post.linked_set.set_num}
              {post.linked_set.theme ? ` \u00B7 ${post.linked_set.theme}` : ""}
              {post.linked_set.year ? ` \u00B7 ${post.linked_set.year}` : ""}
              {post.linked_set.pieces ? ` \u00B7 ${post.linked_set.pieces} pcs` : ""}
            </div>
          </div>
        </Link>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-4 border-t border-zinc-100 pt-3">
        <button
          onClick={toggleLike}
          disabled={likeLoading}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            liked ? "text-red-500" : "text-zinc-500 hover:text-red-500"
          }`}
        >
          {liked ? "\u2764\uFE0F" : "\u2661"} {likesCount}
        </button>

        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700"
        >
          {"\uD83D\uDCAC"} {commentsTotal}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-3 border-t border-zinc-100 pt-3">
          {comments.length === 0 && (
            <p className="text-xs text-zinc-400">No comments yet.</p>
          )}
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Link href={`/users/${encodeURIComponent(c.user.username)}`}>
                  <UserAvatar user={c.user} size={28} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="text-xs">
                    <Link
                      href={`/users/${encodeURIComponent(c.user.username)}`}
                      className="font-semibold text-zinc-900 hover:text-amber-600"
                    >
                      {c.user.display_name || c.user.username}
                    </Link>
                    <span className="ml-2 text-zinc-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-700">{c.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Comment input */}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submitComment(); }}
              placeholder="Write a comment..."
              maxLength={1000}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              onClick={submitComment}
              disabled={!commentText.trim() || commentLoading}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Post Form
// ---------------------------------------------------------------------------

function CreatePostForm({ token, onCreated, initialSetNum }: { token: string; onCreated: (post: PostData) => void; initialSetNum?: string }) {
  const [text, setText] = useState("");
  const [setNum, setSetNum] = useState(initialSetNum ?? "");
  const [showSetField, setShowSetField] = useState(!!initialSetNum);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(async () => {
    const trimmed = text.trim();
    const linkedSet = setNum.trim() || null;
    if (!trimmed && !linkedSet) return;

    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<unknown>("/posts", {
        method: "POST",
        token,
        body: {
          text: trimmed || null,
          linked_set_num: linkedSet,
        },
      });
      const post = coercePost(data);
      if (post) {
        onCreated(post);
        setText("");
        setSetNum("");
        setShowSetField(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create post");
    }
    setLoading(false);
  }, [text, setNum, token, onCreated]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's on your mind? Share a build, review, or anything LEGO..."
        maxLength={2000}
        rows={3}
        className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />

      {showSetField && (
        <input
          type="text"
          value={setNum}
          onChange={(e) => setSetNum(e.target.value)}
          placeholder="Set number (e.g. 75192-1)"
          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setShowSetField(!showSetField)}
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          {showSetField ? "Remove set link" : "Link a set"}
        </button>

        <button
          onClick={submit}
          disabled={loading || (!text.trim() && !setNum.trim())}
          className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggested Users (for empty feed state)
// ---------------------------------------------------------------------------

type SuggestedUser = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

function SuggestedUsers({ token }: { token: string }) {
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ users: SuggestedUser[] }>("/users/suggested?limit=5", { token });
        if (data?.users) setUsers(data.users);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [token]);

  const toggleFollow = useCallback(async (user: SuggestedUser) => {
    const isFollowed = followedIds.has(user.id);
    try {
      if (isFollowed) {
        await apiFetch(`/users/${encodeURIComponent(user.username)}/follow`, { method: "DELETE", token });
        setFollowedIds((prev) => { const next = new Set(prev); next.delete(user.id); return next; });
      } else {
        await apiFetch(`/users/${encodeURIComponent(user.username)}/follow`, { method: "POST", token });
        setFollowedIds((prev) => new Set(prev).add(user.id));
      }
    } catch { /* ignore */ }
  }, [token, followedIds]);

  if (loading) return <p className="mt-4 text-center text-sm text-zinc-400">Finding people to follow...</p>;
  if (users.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-zinc-700">People to follow</h3>
      <div className="mt-3 space-y-2">
        {users.map((u) => {
          const initial = (u.display_name?.[0] || u.username[0] || "?").toUpperCase();
          const isFollowed = followedIds.has(u.id);
          return (
            <div key={u.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <Link href={`/users/${encodeURIComponent(u.username)}`} className="shrink-0">
                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                  {u.avatar_url ? (
                    <Image src={u.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" />
                  ) : (
                    initial
                  )}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/users/${encodeURIComponent(u.username)}`} className="block truncate text-sm font-semibold text-zinc-800 hover:underline">
                  {u.display_name || u.username}
                </Link>
                {u.display_name && (
                  <p className="truncate text-xs text-zinc-500">@{u.username}</p>
                )}
              </div>
              <button
                onClick={() => toggleFollow(u)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  isFollowed
                    ? "border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                    : "bg-amber-500 text-white hover:bg-amber-600"
                }`}
              >
                {isFollowed ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Feed
// ---------------------------------------------------------------------------

export default function SocialFeedClient() {
  const { token, hydrated, me } = useAuth();
  const isLoggedIn = hydrated && !!token;
  const searchParams = useSearchParams();
  const shareSetNum = searchParams.get("share") ?? undefined;

  const [tab, setTab] = useState<"following" | "discover">("following");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const currentUserId = me?.id != null ? Number(me.id) : null;

  const loadPosts = useCallback(async (pageNum: number, feedTab: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const endpoint = feedTab === "following" ? "/feed" : "/feed/discover";
      const data = await apiFetch<unknown>(`${endpoint}?page=${pageNum}&limit=20`, { token });
      if (isRecord(data) && Array.isArray(data.posts)) {
        const parsed: PostData[] = [];
        for (const p of data.posts) {
          const post = coercePost(p);
          if (post) parsed.push(post);
        }
        setPosts(pageNum === 1 ? parsed : (prev) => [...prev, ...parsed]);
        setTotal(typeof data.total === "number" ? data.total : 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setPage(1);
    setPosts([]);
    void loadPosts(1, tab);
  }, [isLoggedIn, tab, loadPosts]);

  const handlePostCreated = useCallback((post: PostData) => {
    setPosts((prev) => [post, ...prev]);
    setTotal((t) => t + 1);
  }, []);

  const handlePostDeleted = useCallback((id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    void loadPosts(nextPage, tab);
  }, [page, tab, loadPosts]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl px-6 pb-16">
        <h1 className="mt-10 text-2xl font-bold text-zinc-900">Feed</h1>
        <p className="mt-4 text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-2xl px-6 pb-16">
        <h1 className="mt-10 text-2xl font-bold text-zinc-900">Feed</h1>
        <p className="mt-4 text-sm text-zinc-500">
          <Link href="/sign-in" className="font-semibold text-amber-600 hover:underline">
            Sign in
          </Link>{" "}
          to see posts from people you follow.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pb-16">
      <h1 className="mt-10 text-2xl font-bold text-zinc-900">Feed</h1>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-full bg-zinc-100 p-1">
        <button
          onClick={() => setTab("following")}
          className={`flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            tab === "following"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Following
        </button>
        <button
          onClick={() => setTab("discover")}
          className={`flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            tab === "discover"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Discover
        </button>
      </div>

      {/* Create post */}
      <div className="mt-6">
        <CreatePostForm token={token} onCreated={handlePostCreated} initialSetNum={shareSetNum} />
      </div>

      {/* Posts */}
      <div className="mt-6 space-y-4">
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            token={token}
            currentUserId={currentUserId}
            onDelete={handlePostDeleted}
          />
        ))}
      </div>

      {loading && <p className="mt-4 text-center text-sm text-zinc-400">Loading...</p>}

      {!loading && posts.length === 0 && (
        <div className="mt-8">
          <p className="text-center text-sm text-zinc-500">
            {tab === "following"
              ? "No posts yet. Follow some users to see their posts here!"
              : "No posts yet. Be the first to share something!"}
          </p>
          {tab === "following" && token && <SuggestedUsers token={token} />}
        </div>
      )}

      {!loading && posts.length < total && (
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
