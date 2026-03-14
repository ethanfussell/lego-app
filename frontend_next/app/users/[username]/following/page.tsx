// frontend_next/app/users/[username]/following/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { siteBase } from "@/lib/url";
import { isRecord } from "@/lib/types";

type FollowUser = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export const dynamic = "force-static";
export const revalidate = 3600;

type Params = { username: string };

function normalizeUsername(raw: string): string | null {
  const decoded = decodeURIComponent(String(raw || "")).trim();
  if (!decoded) return null;
  if (!/^[A-Za-z0-9_]{2,30}$/.test(decoded)) return null;
  return decoded;
}

const fetchFollowing = cache(async (username: string): Promise<{ total: number; users: FollowUser[] }> => {
  const url = new URL(`/api/users/${encodeURIComponent(username)}/following?limit=100`, siteBase()).toString();

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  } catch {
    return { total: 0, users: [] };
  }

  if (!res.ok) return { total: 0, users: [] };

  const data: unknown = await res.json().catch(() => null);
  if (!isRecord(data)) return { total: 0, users: [] };

  const users: FollowUser[] = [];
  const arr = Array.isArray(data.users) ? data.users : [];
  for (const u of arr) {
    if (!isRecord(u)) continue;
    if (typeof u.id !== "number" || typeof u.username !== "string") continue;
    users.push({
      id: u.id,
      username: u.username,
      display_name: typeof u.display_name === "string" ? u.display_name : null,
      avatar_url: typeof u.avatar_url === "string" ? u.avatar_url : null,
    });
  }

  return { total: typeof data.total === "number" ? data.total : users.length, users };
});

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const p = await Promise.resolve(params);
  const username = normalizeUsername(p.username) ?? "user";
  return {
    title: `@${username} is following`,
    description: `People @${username} follows on BrickTrack.`,
  };
}

export default async function FollowingPage({ params }: { params: Params | Promise<Params> }) {
  const p = await Promise.resolve(params);
  const username = normalizeUsername(p.username);
  if (!username) notFound();

  const { total, users } = await fetchFollowing(username);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16">
      <div className="pt-10">
        <Link href={`/users/${encodeURIComponent(username)}`} className="text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Back to @{username}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-zinc-900">
          Following <span className="text-zinc-400">({total})</span>
        </h1>
      </div>

      {users.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">Not following anyone yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/users/${encodeURIComponent(u.username)}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 hover:border-zinc-300"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                  {u.avatar_url ? (
                    <Image src={u.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" />
                  ) : (
                    (u.display_name?.[0] || u.username[0] || "?").toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900">
                    {u.display_name || u.username}
                  </div>
                  <div className="text-xs text-zinc-500">@{u.username}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
