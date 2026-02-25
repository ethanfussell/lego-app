// frontend_next/app/users/[username]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

type PublicUser = {
  id: number;
  username: string;
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

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  // MUST be absolute for SSR fetch during prerender
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

type Params = { username: string };

function normalizeUsername(raw: string): string | null {
  const decoded = decodeURIComponent(String(raw || "")).trim();
  if (!decoded) return null;

  // Safe, cache-friendly username pattern.
  // Adjust if you want hyphens/dots/etc.
  if (!/^[A-Za-z0-9_]{2,30}$/.test(decoded)) return null;

  return decoded;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceUser(x: unknown): PublicUser | null {
  if (!isRecord(x)) return null;

  const id = (x as any).id;
  const username = (x as any).username;

  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  if (typeof username !== "string" || !username.trim()) return null;

  return { id, username: username.trim() };
}

function coercePublicLists(x: unknown): PublicListRow[] {
  // /api/lists/public can be either [] or { results: [] }
  const arr = Array.isArray(x)
    ? x
    : isRecord(x) && Array.isArray((x as any).results)
      ? ((x as any).results as unknown[])
      : [];

  const out: PublicListRow[] = [];
  for (const it of arr) {
    if (!isRecord(it)) continue;

    const id = (it as any).id;
    const title = (it as any).title;
    const owner = (it as any).owner;

    if (typeof id !== "number" || !Number.isFinite(id)) continue;
    if (typeof title !== "string" || !title.trim()) continue;
    if (typeof owner !== "string" || !owner.trim()) continue;

    out.push({
      id,
      title: title.trim(),
      description:
        typeof (it as any).description === "string"
          ? (it as any).description
          : (it as any).description == null
            ? null
            : String((it as any).description),
      owner: owner.trim(),
      items_count:
        typeof (it as any).items_count === "number" && Number.isFinite((it as any).items_count)
          ? Math.max(0, Math.floor((it as any).items_count))
          : 0,
      created_at: typeof (it as any).created_at === "string" ? (it as any).created_at : null,
      updated_at: typeof (it as any).updated_at === "string" ? (it as any).updated_at : null,
    });
  }
  return out;
}

const fetchUserSSR = cache(async (username: string): Promise<PublicUser | null> => {
  const url = new URL(`/api/users/${encodeURIComponent(username)}`, siteBase()).toString();
  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });

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
  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
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

  const title = `@${user.username}`;
  const description = `Public profile for @${user.username}.`;

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

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">{SITE_NAME}</div>

        <h1 className="mt-2 text-3xl font-bold">@{user.username}</h1>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Public lists by this user</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/lists/public"
            className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            Browse public lists
          </Link>
        </div>
      </div>

      {lists.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">No public lists yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {lists.map((l) => (
            <li
              key={l.id}
              className="rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-white/[.14] dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/lists/${encodeURIComponent(String(l.id))}`}
                    className="truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {l.title}
                  </Link>

                  {l.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{l.description}</p>
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