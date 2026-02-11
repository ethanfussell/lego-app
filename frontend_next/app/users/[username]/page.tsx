// frontend_next/app/users/[username]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

type PublicUser = {
  id: number;
  username: string;
};

type PublicList = {
  id: number;
  title: string;
  description?: string | null;
  items_count?: number;
  owner?: string;
};

type PromiseLikeValue<T> = {
  then: (onFulfilled: (value: T) => unknown) => unknown;
};
function isPromiseLike<T>(v: unknown): v is PromiseLikeValue<T> {
  return typeof v === "object" && v !== null && "then" in v && typeof (v as { then?: unknown }).then === "function";
}
async function unwrap<T>(p: T | Promise<T>): Promise<T> {
  return isPromiseLike<T>(p) ? await (p as Promise<T>) : (p as T);
}

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function isPublicUser(x: unknown): x is PublicUser {
  if (typeof x !== "object" || x === null) return false;
  const u = x as { id?: unknown; username?: unknown };
  return typeof u.id === "number" && typeof u.username === "string" && u.username.trim() !== "";
}

function isPublicList(x: unknown): x is PublicList {
  if (typeof x !== "object" || x === null) return false;
  const l = x as { id?: unknown; title?: unknown };
  return typeof l.id === "number" && typeof l.title === "string" && l.title.trim() !== "";
}

const fetchUser = cache(async (username: string): Promise<PublicUser | null> => {
  const url = `${apiBase()}/users/${encodeURIComponent(username)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const data: unknown = await res.json();
  return isPublicUser(data) ? data : null;
});

const fetchUserLists = cache(async (username: string): Promise<PublicList[]> => {
  const url = `${apiBase()}/users/${encodeURIComponent(username)}/lists`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) return [];

  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data.filter(isPublicList);
});

export async function generateMetadata({
  params,
}: {
  params: { username: string } | Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await unwrap(params);
  const decoded = decodeURIComponent(username);

  // If the user doesn't exist, return a "noindex" metadata set (and the page will 404 via notFound()).
  const user = await fetchUser(decoded);

  const canonical = `/users/${encodeURIComponent(decoded)}`;

  if (!user) {
    const title = "User not found";
    const description = `No public profile for @${decoded}.`;
    return {
      title,
      description,
      metadataBase: new URL(siteBase()),
      alternates: { canonical },
      robots: { index: false, follow: false },
      openGraph: { title, description, url: canonical, type: "website" },
      twitter: { card: "summary", title, description },
    };
  }

  const title = `@${user.username}`;
  const description = `Public profile for @${user.username} on ${SITE_NAME}.`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "profile",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function UserPage({
  params,
}: {
  params: { username: string } | Promise<{ username: string }>;
}) {
  const { username } = await unwrap(params);
  const decoded = decodeURIComponent(username);

  const [user, lists] = await Promise.all([fetchUser(decoded), fetchUserLists(decoded)]);

  // ✅ KEY FIX: real 404 status (instead of a "User not found" page with HTTP 200)
  if (!user) notFound();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <div className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">{SITE_NAME}</div>
        <h1 className="mt-2 text-3xl font-bold">@{user.username}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Public lists (newest first)</p>
      </div>

      {lists.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">No public lists yet.</p>
      ) : (
        <ul className="space-y-3">
          {lists.map((l) => (
            <li
              key={l.id}
              className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-black"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Link
                    href={`/lists/${encodeURIComponent(String(l.id))}`}
                    className="text-lg font-semibold hover:underline"
                  >
                    {l.title}
                  </Link>
                  {l.description ? <p className="mt-1 text-zinc-600 dark:text-zinc-400">{l.description}</p> : null}
                </div>

                {typeof l.items_count === "number" ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">{l.items_count} items</div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}