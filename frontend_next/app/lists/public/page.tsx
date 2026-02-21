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
  results: PublicListRow[];
  total: number;
  total_pages: number;
  page: number;
  limit: number;
  sort: SortKey;
  owner: string;
  q: string;
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
  if (raw === "count_desc" || raw === "name_asc" || raw === "updated_desc") return raw;
  return "updated_desc";
}

async function fetchPublicListsSSR(opts: { owner: string; q: string; sort: SortKey; page: number }) {
  const qs = new URLSearchParams();
  if (opts.owner) qs.set("owner", opts.owner);
  if (opts.q) qs.set("q", opts.q);
  if (opts.sort !== "updated_desc") qs.set("sort", opts.sort);
  if (opts.page > 1) qs.set("page", String(opts.page));

  const res = await fetch(`/api/lists/public${qs.toString() ? `?${qs.toString()}` : ""}`, {
    next: { revalidate },
  });

  if (!res.ok) return { results: [] as PublicListRow[], total_pages: 1, page: opts.page, error: `HTTP ${res.status}` };

  const data: ApiResp = await res.json().catch(() => null as any);
  const results = Array.isArray(data?.results) ? data.results : [];
  const total_pages = Number.isFinite(data?.total_pages) ? data.total_pages : 1;
  const page = Number.isFinite(data?.page) ? data.page : opts.page;

  return { results, total_pages, page, error: null as string | null };
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