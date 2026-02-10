// frontend_next/app/users/[username]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

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

const SITE_NAME = "YourSite";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

// ✅ FIX: remove /api prefix and correct endpoint (this one should fetch the user)
async function fetchUser(username: string): Promise<PublicUser | null> {
  const res = await fetch(`${apiBase()}/users/${encodeURIComponent(username)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as PublicUser;
}

// ✅ FIX: remove /api prefix (lists endpoint)
async function fetchUserLists(username: string): Promise<PublicList[]> {
  const res = await fetch(`${apiBase()}/users/${encodeURIComponent(username)}/lists`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as PublicList[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  const canonical = `/users/${encodeURIComponent(decoded)}`;
  const title = `@${decoded}`;
  const description = `Public profile for @${decoded} on ${SITE_NAME}.`;

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
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  const [user, lists] = await Promise.all([fetchUser(decoded), fetchUserLists(decoded)]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">User not found</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">No public profile for @{decoded}.</p>
        <Link className="mt-4 inline-block underline" href="/">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <div className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">
          {SITE_NAME}
        </div>
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
                  {l.description ? (
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">{l.description}</p>
                  ) : null}
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