// frontend_next/app/lists/public/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import PublicListsClient from "./PublicListsClient";
import { FEATURED_LISTS } from "@/lib/featuredLists";
import { siteBase } from "@/lib/url";
import { isRecord, type UnknownRecord } from "@/lib/types";
import { first } from "@/lib/searchParams";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Public Lists",
  description: "Browse lists shared by the community.",
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/lists/public" },
  openGraph: {
    title: "Public Lists",
    description: "Browse lists shared by the community.",
    url: "/lists/public",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Public Lists",
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

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function parseSort(raw: string): SortKey {
  return raw === "count_desc" || raw === "name_asc" || raw === "updated_desc" ? raw : "updated_desc";
}

function isPublicListRow(x: unknown): x is PublicListRow {
  if (!isRecord(x)) return false;

  return (
    typeof x.id === "number" &&
    Number.isFinite(x.id) &&
    typeof x.title === "string" &&
    typeof x.owner === "string" &&
    typeof x.items_count === "number"
  );
}

function toRows(x: unknown): PublicListRow[] {
  if (Array.isArray(x)) return x.filter(isPublicListRow);

  if (isRecord(x) && Array.isArray(x.results)) {
    return (x.results as unknown[]).filter(isPublicListRow);
  }

  return [];
}

function FeaturedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-50 px-2 py-0.5 text-[11px] font-extrabold text-amber-300">
      Featured
    </span>
  );
}

function pickCount(l: { items_count?: number | null }) {
  const n = Number(l.items_count ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function pickOwnerFromListDetail(data: UnknownRecord): string {
  const u1 = typeof data.owner_username === "string" ? data.owner_username.trim() : "";
  if (u1) return u1;
  const u2 = typeof data.owner === "string" ? data.owner.trim() : "";
  if (u2) return u2;
  return "unknown";
}

function pickTitleFromListDetail(data: UnknownRecord, fallback: string): string {
  const t = typeof data.title === "string" ? data.title.trim() : "";
  return t || fallback;
}

function pickDescriptionFromListDetail(data: UnknownRecord): string | null {
  const d = typeof data.description === "string" ? data.description.trim() : "";
  return d || null;
}

function pickItemsCountFromListDetail(data: UnknownRecord): number {
  const n = data.items_count;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function pickDateStr(data: UnknownRecord, key: "created_at" | "updated_at"): string | null {
  const v = data[key];
  return typeof v === "string" && v.trim() ? v : null;
}

async function fetchFeaturedListsSSR(): Promise<PublicListRow[]> {
  if (!Array.isArray(FEATURED_LISTS) || FEATURED_LISTS.length === 0) return [];

  const results = await Promise.all(
    FEATURED_LISTS.slice(0, 12).map(async (f) => {
      const idStr = String(f.id);
      const url = new URL(`/api/lists/${encodeURIComponent(idStr)}`, siteBase()).toString();

      const res = await fetch(url, { next: { revalidate } });
      if (!res.ok) return null;

      const data: unknown = await res.json().catch(() => null);
      if (!isRecord(data)) return null;

      const row: PublicListRow = {
        id: typeof data.id === "number" && Number.isFinite(data.id) ? data.id : Number(f.id),
        title: pickTitleFromListDetail(data, `List #${idStr}`),
        description: pickDescriptionFromListDetail(data),
        owner: pickOwnerFromListDetail(data),
        items_count: pickItemsCountFromListDetail(data),
        created_at: pickDateStr(data, "created_at"),
        updated_at: pickDateStr(data, "updated_at"),
      };

      // Optional title override from FEATURED_LISTS
      if (typeof f.title === "string" && f.title.trim()) row.title = f.title.trim();

      return row;
    })
  );

  return results.filter((x): x is PublicListRow => Boolean(x));
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
      isRecord(data) && typeof data.total_pages === "number" && Number.isFinite(data.total_pages)
        ? Math.max(1, Math.floor(data.total_pages))
        : 1;

    const page =
      isRecord(data) && typeof data.page === "number" && Number.isFinite(data.page)
        ? Math.max(1, Math.floor(data.page))
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
        <p className="mt-2 text-sm text-zinc-500">Browse lists shared by the community.</p>
      </div>

      {/* Featured section */}
      {featured.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="m-0 text-lg font-semibold">Featured lists</h2>
                <FeaturedBadge />
              </div>
              <p className="mt-1 text-sm text-zinc-500">Curated picks to explore.</p>
            </div>
            <Link href="/discover" className="text-sm font-semibold hover:underline">
              Discover sets →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((l) => {
              const id = String(l.id);
              const count = pickCount(l);

              return (
                <div
                  key={id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-300 hover:bg-zinc-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/lists/${encodeURIComponent(id)}`}
                        className="block truncate text-sm font-semibold text-zinc-900 hover:underline hover:text-amber-600"
                      >
                        {l.title}
                      </Link>

                      <div className="mt-1 text-xs text-zinc-500">
                        by{" "}
                        <Link href={`/users/${encodeURIComponent(l.owner)}`} className="font-semibold hover:underline">
                          {l.owner}
                        </Link>
                        <span className="mx-1">•</span>
                        {count} set{count === 1 ? "" : "s"}
                      </div>
                    </div>

                    <FeaturedBadge />
                  </div>

                  {l.description ? (
                    <p className="mt-3 line-clamp-3 text-sm text-zinc-500">{l.description}</p>
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