// frontend_next/app/lists/public/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import PublicListsClient from "./PublicListsClient";
import { FEATURED_LISTS } from "@/lib/featuredLists";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

export const dynamic = "force-static";
export const revalidate = 3600;

function siteBase() {
  // MUST be an absolute origin for SSR fetch() during prerender
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export const metadata: Metadata = {
  title: "Public Lists",
  description: "Browse lists shared by the community.",
  metadataBase: new URL(siteBase()),
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

type SortKey = "updated_desc" | "count_desc" | "name_asc";
type SearchParams = Record<string, string | string[] | undefined>;

type PublicListRow = {
  id: number;
  title: string;
  description: string | null;
  owner: string;
  items_count: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiResp = {
  results?: unknown;
  total_pages?: unknown;
  page?: unknown;
};

function first(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v || "").toString().trim();
}

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function parseSort(raw: string): SortKey {
  return raw === "count_desc" || raw === "name_asc" || raw === "updated_desc" ? raw : "updated_desc";
}

function isPublicListRow(x: unknown): x is PublicListRow {
  if (typeof x !== "object" || x === null) return false;
  const o = x as any;
  return typeof o.id === "number" && typeof o.title === "string" && typeof o.owner === "string";
}

function toRows(x: unknown): PublicListRow[] {
  if (Array.isArray(x)) return x.filter(isPublicListRow);
  if (typeof x === "object" && x !== null) {
    const r = (x as any).results;
    return Array.isArray(r) ? r.filter(isPublicListRow) : [];
  }
  return [];
}

function FeaturedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-extrabold text-amber-700 dark:text-amber-300">
      Featured
    </span>
  );
}

function pickCount(l: { items_count?: number | null }) {
  const n = Number(l.items_count ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

async function fetchFeaturedListsSSR(): Promise<PublicListRow[]> {
  if (!Array.isArray(FEATURED_LISTS) || FEATURED_LISTS.length === 0) return [];

  const results = await Promise.all(
    FEATURED_LISTS.slice(0, 12).map(async (f) => {
      const id = String(f.id);
      const url = new URL(`/api/lists/${encodeURIComponent(id)}`, siteBase()).toString();

      const res = await fetch(url, { next: { revalidate } });
      if (!res.ok) return null;

      const data: any = await res.json().catch(() => null);
      if (!data || typeof data !== "object") return null;

      const owner =
        (typeof data.owner_username === "string" && data.owner_username.trim()) ||
        (typeof data.owner === "string" && data.owner.trim()) ||
        "unknown";

      const row: PublicListRow = {
        id: typeof data.id === "number" ? data.id : Number(f.id),
        title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : `List #${id}`,
        description: typeof data.description === "string" && data.description.trim() ? data.description.trim() : null,
        owner,
        items_count: typeof data.items_count === "number" && Number.isFinite(data.items_count) ? data.items_count : 0,
        created_at: typeof data.created_at === "string" ? data.created_at : null,
        updated_at: typeof data.updated_at === "string" ? data.updated_at : null,
      };

      // Optional title override from FEATURED_LISTS
      if (typeof f.title === "string" && f.title.trim()) row.title = f.title.trim();

      return row;
    })
  );

  return results.filter((x): x is PublicListRow => !!x);
}

async function fetchPublicListsSSR(opts: { owner: string; q: string; sort: SortKey; page: number }) {
  const qs = new URLSearchParams();
  if (opts.owner) qs.set("owner", opts.owner);
  if (opts.q) qs.set("q", opts.q);
  if (opts.sort !== "updated_desc") qs.set("sort", opts.sort);
  if (opts.page > 1) qs.set("page", String(opts.page));

  const url = new URL(`/api/lists/public${qs.toString() ? `?${qs.toString()}` : ""}`, siteBase()).toString();

  try {
    const res = await fetch(url, { next: { revalidate } });

    if (!res.ok) {
      return { results: [] as PublicListRow[], total_pages: 1, page: opts.page, error: `HTTP ${res.status}` };
    }

    const data: ApiResp | unknown = await res.json().catch(() => null);
    const results = toRows(data);

    const total_pages =
      typeof (data as any)?.total_pages === "number" && Number.isFinite((data as any).total_pages)
        ? Math.max(1, Math.floor((data as any).total_pages))
        : 1;

    const page =
      typeof (data as any)?.page === "number" && Number.isFinite((data as any).page)
        ? Math.max(1, Math.floor((data as any).page))
        : opts.page;

    return { results, total_pages, page, error: null as string | null };
  } catch {
    return { results: [] as PublicListRow[], total_pages: 1, page: opts.page, error: "Fetch failed" };
  }
}

export default async function Page({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
  const sp = (await searchParams) ?? {};

  const initialOwner = first(sp, "owner");
  const initialQ = first(sp, "q");
  const initialSort = parseSort(first(sp, "sort") || "updated_desc");
  const initialPage = Math.max(1, toInt(first(sp, "page") || "1", 1));

  const shouldShowFeatured = !initialOwner && !initialQ && initialPage === 1;

  const [r, featured] = await Promise.all([
    fetchPublicListsSSR({ owner: initialOwner, q: initialQ, sort: initialSort, page: initialPage }),
    shouldShowFeatured ? fetchFeaturedListsSSR() : Promise.resolve([] as PublicListRow[]),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <h1 className="m-0 text-2xl font-semibold">Public Lists</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Browse lists shared by the community.</p>
      </div>

      {/* Featured section (Task 8 + Task 9) */}
      {featured.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="m-0 text-lg font-semibold">Featured lists</h2>
                <FeaturedBadge />
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Curated picks to explore.</p>
            </div>
            <Link href="/discover" className="text-sm font-semibold hover:underline">
              Discover sets →
            </Link>
          </div>

          {/* NOTE: Server Component — no onClick, and avoid nested Links */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((l) => {
              const id = String(l.id);
              const count = pickCount(l);

              return (
                <div
                  key={id}
                  className="rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-white/[.14] dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/lists/${encodeURIComponent(id)}`}
                        className="block truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {l.title}
                      </Link>

                      <div className="mt-1 text-xs text-zinc-500">
                        by{" "}
                        <Link
                          href={`/users/${encodeURIComponent(l.owner)}`}
                          className="font-semibold hover:underline"
                        >
                          {l.owner}
                        </Link>
                        <span className="mx-1">•</span>
                        {count} set{count === 1 ? "" : "s"}
                      </div>
                    </div>

                    <FeaturedBadge />
                  </div>

                  {l.description ? (
                    <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">{l.description}</p>
                  ) : (
                    <div className="mt-3">
                      <Link
                        href={`/lists/${encodeURIComponent(id)}`}
                        className="text-sm font-semibold text-zinc-500 hover:underline"
                      >
                        View list →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-10">
        <Suspense fallback={<p className="mt-6 text-sm text-zinc-500">Loading lists…</p>}>
          <PublicListsClient
            initialOwner={initialOwner}
            initialQ={initialQ}
            initialSort={initialSort}
            initialPage={r.page}
            initialTotalPages={r.total_pages}
            initialLists={r.results}
            initialError={r.error}
          />
        </Suspense>
      </div>
    </div>
  );
}