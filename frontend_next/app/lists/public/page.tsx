// frontend_next/app/lists/public/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import PublicListsClient from "./PublicListsClient";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

// curated IDs (optional; keep yours)
const FEATURED_LIST_IDS = [6, 5, 4];

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
  total?: unknown;
  total_pages?: unknown;
  page?: unknown;
  limit?: unknown;
  sort?: unknown;
  owner?: unknown;
  q?: unknown;
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

  const r = await fetchPublicListsSSR({ owner: initialOwner, q: initialQ, sort: initialSort, page: initialPage });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <h1 className="m-0 text-2xl font-semibold">Public Lists</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Browse lists shared by the community.</p>
      </div>

      {/* Featured chips (optional) */}
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

        <div className="mt-4 flex flex-wrap gap-2">
          {FEATURED_LIST_IDS.map((id) => (
            <Link
              key={id}
              href={`/lists/${id}`}
              className="inline-flex items-center justify-center rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Featured #{id} →
            </Link>
          ))}
        </div>
      </section>

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