// frontend_next/app/lists/public/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import PublicListsClient from "./PublicListsClient";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

// ✅ Manual curated IDs (update anytime)
const FEATURED_LIST_IDS = [6, 5, 4]; // add up to 10

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Public Lists",
  description: "Browse lists shared by the community.",
  alternates: { canonical: "/lists/public" },
  openGraph: {
    title: `Public Lists | ${SITE_NAME}`,
    description: "Browse lists shared by the community.",
    url: "/lists/public",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Public Lists | ${SITE_NAME}`,
    description: "Browse lists shared by the community.",
  },
};

type PublicListRow = {
  id: number;
  title: string;
  description: string | null;
  owner: string;
  items_count: number;
  is_public: boolean;
  updated_at?: string | null;
  created_at?: string | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v || "").toString().trim();
}

function isPublicListRow(x: unknown): x is PublicListRow {
  if (typeof x !== "object" || x === null) return false;
  const o = x as any;
  return typeof o.id === "number" && typeof o.title === "string" && typeof o.owner === "string";
}

function toPublicListRowArray(x: unknown): PublicListRow[] {
  if (Array.isArray(x)) return x.filter(isPublicListRow);
  if (typeof x === "object" && x !== null) {
    const r = (x as any).results;
    return Array.isArray(r) ? r.filter(isPublicListRow) : [];
  }
  return [];
}

async function fetchPublicLists(owner: string): Promise<{ lists: PublicListRow[]; error: string | null }> {
  try {
    const qs = new URLSearchParams();
    if (owner) qs.set("owner", owner);

    // ✅ Same-origin route handler (works on Vercel + locally)
    const path = `/api/lists/public${qs.toString() ? `?${qs.toString()}` : ""}`;

    const res = await fetch(path, { next: { revalidate } });
    if (!res.ok) return { lists: [], error: `HTTP ${res.status}` };

    const data: unknown = await res.json();
    return { lists: toPublicListRowArray(data), error: null };
  } catch (e: any) {
    return { lists: [], error: e?.message ? String(e.message) : "Fetch failed" };
  }
}

function pickFeatured(from: PublicListRow[]): PublicListRow[] {
  const byId = new Map<number, PublicListRow>();
  for (const r of from) byId.set(r.id, r);

  // Keep the curated order; only include ones we actually have
  const out: PublicListRow[] = [];
  for (const id of FEATURED_LIST_IDS) {
    const hit = byId.get(id);
    if (hit) out.push(hit);
  }
  return out;
}

function isNonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const initialOwner = first(sp, "owner"); // ✅ server-driven filter if present

  const { lists: initialLists, error: initialError } = await fetchPublicLists(initialOwner);

  // Only “decorate” featured lists when we’re showing ALL lists (no owner filter).
  // If owner is set, initialLists will be filtered and likely won’t include the featured IDs.
  const featured = initialOwner ? [] : pickFeatured(initialLists);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <h1 className="m-0 text-2xl font-semibold">Public Lists</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Browse lists shared by the community.</p>
      </div>

      {/* ✅ Featured lists: server-rendered internal links (with titles when available) */}
      <section className="mt-8 rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-semibold">Featured lists</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Curated picks to explore.</p>
          </div>
          <Link href="/discover" className="text-sm font-semibold hover:underline">
            Discover sets →
          </Link>
        </div>

        {/* If we have the rows, show richer cards; otherwise fall back to ID chips */}
        {featured.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {featured.map((l) => (
              <Link
                key={l.id}
                href={`/lists/${l.id}`}
                className="rounded-2xl border border-black/[.10] bg-white p-4 hover:bg-black/[.03] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{l.title}</div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      by <span className="font-semibold">{l.owner}</span> • {l.items_count} sets
                    </div>
                    {isNonEmpty(l.description) ? (
                      <div className="mt-2 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{l.description}</div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-sm font-semibold">→</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {FEATURED_LIST_IDS.map((id) => (
              <Link
                key={id}
                href={`/lists/${id}`}
                className="inline-flex items-center justify-center rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
              >
                Featured list #{id} →
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Client experience */}
      <div className="mt-10">
        <Suspense fallback={<p className="mt-6 text-sm text-zinc-500">Loading lists…</p>}>
          <PublicListsClient initialOwner={initialOwner} initialLists={initialLists} initialError={initialError} />
        </Suspense>
      </div>
    </div>
  );
}