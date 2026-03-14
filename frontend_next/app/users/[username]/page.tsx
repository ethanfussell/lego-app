// frontend_next/app/users/[username]/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { siteBase, SITE_NAME } from "@/lib/url";
import { isRecord, type UnknownRecord } from "@/lib/types";
import FollowButton from "@/app/components/FollowButton";

type PublicUser = {
  id: number;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  created_at: string | null;
  followers_count: number;
  following_count: number;
};

type PublicListRow = {
  id: number;
  title: string;
  description: string | null;
  owner: string;
  items_count: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export const dynamic = "force-static";
export const revalidate = 3600;

type Params = { username: string };

function normalizeUsername(raw: string): string | null {
  const decoded = decodeURIComponent(String(raw || "")).trim();
  if (!decoded) return null;

  // Safe, cache-friendly username pattern.
  // Adjust if you want hyphens/dots/etc.
  if (!/^[A-Za-z0-9_]{2,30}$/.test(decoded)) return null;

  return decoded;
}

function coerceUser(x: unknown): PublicUser | null {
  if (!isRecord(x)) return null;

  const id = x.id;
  const username = x.username;

  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  if (typeof username !== "string" || !username.trim()) return null;

  return {
    id,
    username: username.trim(),
    display_name: typeof x.display_name === "string" ? x.display_name : null,
    bio: typeof x.bio === "string" ? x.bio : null,
    avatar_url: typeof x.avatar_url === "string" ? x.avatar_url : null,
    location: typeof x.location === "string" ? x.location : null,
    created_at: typeof x.created_at === "string" ? x.created_at : null,
    followers_count: typeof x.followers_count === "number" ? x.followers_count : 0,
    following_count: typeof x.following_count === "number" ? x.following_count : 0,
  };
}

function coercePublicLists(x: unknown): PublicListRow[] {
  // /api/lists/public can be either [] or { results: [] }
  const arr: unknown[] = Array.isArray(x)
    ? x
    : isRecord(x) && Array.isArray(x.results)
      ? (x.results as unknown[])
      : [];

  const out: PublicListRow[] = [];

  for (const it of arr) {
    if (!isRecord(it)) continue;

    const id = it.id;
    const title = it.title;
    const owner = it.owner;

    if (typeof id !== "number" || !Number.isFinite(id)) continue;
    if (typeof title !== "string" || !title.trim()) continue;
    if (typeof owner !== "string" || !owner.trim()) continue;

    const descRaw = it.description;
    const itemsCountRaw = it.items_count;

    out.push({
      id,
      title: title.trim(),
      description:
        typeof descRaw === "string" ? descRaw : descRaw == null ? null : String(descRaw),
      owner: owner.trim(),
      items_count:
        typeof itemsCountRaw === "number" && Number.isFinite(itemsCountRaw)
          ? Math.max(0, Math.floor(itemsCountRaw))
          : 0,
      created_at: typeof it.created_at === "string" ? it.created_at : null,
      updated_at: typeof it.updated_at === "string" ? it.updated_at : null,
    });
  }

  return out;
}

const fetchUserSSR = cache(async (username: string): Promise<PublicUser | null> => {
  const url = new URL(`/api/users/${encodeURIComponent(username)}`, siteBase()).toString();

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  } catch {
    return null;
  }

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const data: unknown = await res.json().catch(() => null);
  return coerceUser(data);
});

const fetchPublicListsByOwnerSSR = cache(async (username: string): Promise<PublicListRow[]> => {
  const qs = new URLSearchParams();
  qs.set("owner", username);
  qs.set("sort", "updated_desc");
  qs.set("page", "1");

  const url = new URL(`/api/lists/public?${qs.toString()}`, siteBase()).toString();

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  return coercePublicLists(data);
});

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const p = await Promise.resolve(params);
  const normalized = normalizeUsername(p.username);

  const safe = normalized ?? "user";
  const canonicalPath = `/users/${encodeURIComponent(safe)}`;

  const user = normalized ? await fetchUserSSR(normalized) : null;

  if (!normalized || !user) {
    const title = "User not found";
    const description = `No public profile for @${safe}.`;
    return {
      title,
      description,
      metadataBase: new URL(siteBase()),
      alternates: { canonical: canonicalPath },
      robots: { index: false, follow: false },
      openGraph: { title, description, url: canonicalPath, type: "website" },
      twitter: { card: "summary", title, description },
    };
  }

  const title = user.display_name ? `${user.display_name} (@${user.username})` : `@${user.username}`;
  const description = user.bio || `Public profile for @${user.username}.`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath, type: "profile" },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page({ params }: { params: Params | Promise<Params> }) {
  const p = await Promise.resolve(params);
  const username = normalizeUsername(p.username);
  if (!username) notFound();

  const [user, lists] = await Promise.all([fetchUserSSR(username), fetchPublicListsByOwnerSSR(username)]);
  if (!user) notFound();

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-amber-100 text-3xl font-bold text-amber-700">
            {user.avatar_url ? (
              <Image src={user.avatar_url} alt="" width={80} height={80} className="h-full w-full object-cover" />
            ) : (
              (user.display_name?.[0] || user.username[0] || "?").toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <h1 className="m-0 text-2xl font-bold text-zinc-900">
              {user.display_name || user.username}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              @{user.username}
              {user.location ? <> &middot; {user.location}</> : null}
              {memberSince ? <> &middot; Joined {memberSince}</> : null}
            </p>

            <div className="mt-2 flex items-center gap-4 text-sm">
              <Link href={`/users/${encodeURIComponent(user.username)}/followers`} className="text-zinc-600 hover:text-zinc-900">
                <span className="font-bold text-zinc-900">{user.followers_count}</span> follower{user.followers_count === 1 ? "" : "s"}
              </Link>
              <Link href={`/users/${encodeURIComponent(user.username)}/following`} className="text-zinc-600 hover:text-zinc-900">
                <span className="font-bold text-zinc-900">{user.following_count}</span> following
              </Link>
            </div>

            {user.bio ? (
              <p className="mt-2 max-w-lg text-sm text-zinc-600">{user.bio}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <FollowButton username={user.username} />
          <Link
            href="/lists/public"
            className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold hover:bg-zinc-100"
          >
            Browse public lists
          </Link>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-bold text-zinc-900">Public lists</h2>

      {lists.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No public lists yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {lists.map((l) => (
            <li
              key={l.id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/lists/${encodeURIComponent(String(l.id))}`}
                    className="truncate text-sm font-semibold text-zinc-900 hover:text-amber-600"
                  >
                    {l.title}
                  </Link>

                  {l.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{l.description}</p>
                  ) : null}

                  <div className="mt-2 text-xs text-zinc-500">
                    {l.items_count} set{l.items_count === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="shrink-0 text-sm font-semibold">→</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}