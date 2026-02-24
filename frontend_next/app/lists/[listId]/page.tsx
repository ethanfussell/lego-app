// frontend_next/app/lists/[listId]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { themeToSlug } from "@/lib/slug";
import { cache } from "react";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

export const dynamic = "force-static";
export const revalidate = 3600;

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

type Params = { listId: string };

function normalizeListId(raw: string): string | null {
  const decoded = decodeURIComponent(String(raw || "")).trim();
  if (!/^\d+$/.test(decoded)) return null;

  const n = Number(decoded);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  if (n > 2147483647) return null;

  return decoded;
}

function normalizeUsername(raw: unknown): string | null {
  const u = String(raw ?? "").trim();
  return u ? u : null;
}

type ListDetail = {
  id: number;
  title: string | null;
  description: string | null;
  is_public: boolean;
  owner: string | null;
  owner_username: string | null;
  items_count: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  items?: Array<{ set_num: string }> | null;
  set_nums?: string[] | null;
};

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string;
  image_url?: string | null;
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

type ApiResp = { results?: unknown; total_pages?: unknown; page?: unknown };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPublicListRow(x: unknown): x is PublicListRow {
  if (!isRecord(x)) return false;
  const o = x as any;
  return (
    typeof o.id === "number" &&
    Number.isFinite(o.id) &&
    typeof o.title === "string" &&
    typeof o.owner === "string"
  );
}

function toRows(x: unknown): PublicListRow[] {
  if (Array.isArray(x)) return x.filter(isPublicListRow);
  if (isRecord(x) && Array.isArray((x as any).results)) return ((x as any).results as unknown[]).filter(isPublicListRow);
  return [];
}

function coerceListDetail(x: unknown): ListDetail | null {
  if (!isRecord(x)) return null;

  const id = (x as any).id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;

  const title = typeof (x as any).title === "string" ? (x as any).title : (x as any).title == null ? null : String((x as any).title);
  const description =
    typeof (x as any).description === "string"
      ? (x as any).description
      : (x as any).description == null
        ? null
        : String((x as any).description);

  const is_public = typeof (x as any).is_public === "boolean" ? (x as any).is_public : false;

  const owner = typeof (x as any).owner === "string" ? (x as any).owner : (x as any).owner == null ? null : String((x as any).owner);
  const owner_username =
    typeof (x as any).owner_username === "string"
      ? (x as any).owner_username
      : (x as any).owner_username == null
        ? null
        : String((x as any).owner_username);

  const items_count =
    typeof (x as any).items_count === "number" && Number.isFinite((x as any).items_count)
      ? Math.floor((x as any).items_count)
      : null;

  const created_at = typeof (x as any).created_at === "string" ? (x as any).created_at : null;
  const updated_at = typeof (x as any).updated_at === "string" ? (x as any).updated_at : null;

  const items = Array.isArray((x as any).items)
    ? ((x as any).items as unknown[])
        .filter(isRecord)
        .map((it) => ({ set_num: String((it as any).set_num || "") }))
        .filter((it) => it.set_num.trim().length > 0)
    : null;

  const set_nums = Array.isArray((x as any).set_nums)
    ? ((x as any).set_nums as unknown[]).map((s) => String(s || "").trim()).filter(Boolean)
    : null;

  return {
    id,
    title: title?.trim() ? title.trim() : null,
    description: description?.trim() ? description.trim() : null,
    is_public,
    owner: owner?.trim() ? owner.trim() : null,
    owner_username: owner_username?.trim() ? owner_username.trim() : null,
    items_count,
    created_at,
    updated_at,
    items,
    set_nums,
  };
}

function toSetNums(d: ListDetail): string[] {
  if (Array.isArray(d.set_nums) && d.set_nums.length) return d.set_nums.map((s) => String(s || "").trim()).filter(Boolean);
  if (Array.isArray(d.items) && d.items.length) return d.items.map((it) => String(it.set_num || "").trim()).filter(Boolean);
  return [];
}

function canonicalForList(id: string) {
  return `/lists/${encodeURIComponent(id)}`;
}

const fetchPublicListSSR = cache(async (id: string): Promise<ListDetail | "notfound" | "private"> => {
  const url = `${apiBase()}/lists/${encodeURIComponent(id)}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  } catch {
    return "notfound";
  }

  if (res.status === 404) return "notfound";
  if (res.status === 401 || res.status === 403) return "private";
  if (!res.ok) return "notfound";

  const data: unknown = await res.json().catch(() => null);
  const d = coerceListDetail(data);
  if (!d) return "notfound";
  if (!d.is_public) return "private";

  return d;
});

async function fetchSetsBulkSSR(setNums: string[]): Promise<SetLite[]> {
  const nums = Array.from(new Set(setNums.map((s) => String(s || "").trim()).filter(Boolean)));
  if (nums.length === 0) return [];

  const capped = nums.slice(0, 60);

  const params = new URLSearchParams();
  params.set("set_nums", capped.join(","));

  const url = `${apiBase()}/sets/bulk?${params.toString()}`;

  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  if (!Array.isArray(data)) return [];

  const arr = (data as unknown[])
    .filter(isRecord)
    .filter((x) => typeof (x as any).set_num === "string" && String((x as any).set_num).trim())
    .map((x) => {
      const o = x as any;
      return {
        set_num: String(o.set_num),
        name: typeof o.name === "string" ? o.name : undefined,
        year: typeof o.year === "number" ? o.year : undefined,
        pieces: typeof o.pieces === "number" ? o.pieces : undefined,
        theme: typeof o.theme === "string" ? o.theme : undefined,
        image_url: typeof o.image_url === "string" ? o.image_url : null,
      } as SetLite;
    });

  const byNum = new Map(arr.map((s) => [s.set_num, s]));
  return capped.map((n) => byNum.get(n)).filter((v): v is SetLite => !!v);
}

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);

  const safeId = normalized ?? "list";
  const canonicalPath = canonicalForList(safeId);

  // If the param is invalid, keep metadata stable + noindex
  if (!normalized) {
    const title = `List not found | ${SITE_NAME}`;
    const description = "This list does not exist.";
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

  const d = await fetchPublicListSSR(normalized);

  // If private/missing, avoid indexing (page will 404)
  if (d === "notfound" || d === "private") {
    const title = `List ${normalized} not found | ${SITE_NAME}`;
    const description = "This list does not exist or is private.";
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

  const ownerName = normalizeUsername(d.owner_username || d.owner);
  const count =
    typeof d.items_count === "number" && Number.isFinite(d.items_count) ? Math.max(0, Math.floor(d.items_count)) : 0;

  const listTitle = (d.title && d.title.trim()) || `List #${d.id}`;
  const title = ownerName ? `${listTitle} by @${ownerName} | ${SITE_NAME}` : `${listTitle} | ${SITE_NAME}`;

  const desc = (d.description && d.description.trim()) || "";
  const description =
    desc ||
    (ownerName
      ? `Public LEGO list by @${ownerName}. ${count ? `${count} set${count === 1 ? "" : "s"}.` : ""}`.trim()
      : `Public LEGO list. ${count ? `${count} set${count === 1 ? "" : "s"}.` : ""}`.trim());

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

function topCounts<T extends string | number>(items: T[], max = 3): Array<{ key: T; count: number }> {
  const m = new Map<T, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return Array.from(m.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(0, max));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Related lists (simple heuristic):
 * - pick top theme from this list
 * - query /api/lists/public?q=<theme>&sort=count_desc&page=1
 * - filter out current list id
 * - cap to 9 links
 */
async function fetchRelatedListsSSR(opts: { owner: string; excludeId: number; limit?: number }): Promise<PublicListRow[]> {
  const owner = String(opts.owner || "").trim();
  if (!owner) return [];

  const qs = new URLSearchParams();
  qs.set("owner", owner);
  qs.set("sort", "updated_desc");
  qs.set("page", "1");

  const url = new URL(`/api/lists/public?${qs.toString()}`, siteBase()).toString();

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate } });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const data: ApiResp | unknown = await res.json().catch(() => null);
  const rows = toRows(data);

  const out = rows.filter((r) => r.id !== opts.excludeId);
  return out.slice(0, Math.max(1, Math.min(12, opts.limit ?? 9)));
}

export default async function Page({ params }: { params: Params | Promise<Params> }) {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);
  if (!normalized) notFound();

  const d = await fetchPublicListSSR(normalized);
  if (d === "notfound") notFound();
  if (d === "private") notFound();

  const setNums = toSetNums(d);
  const sets = await fetchSetsBulkSSR(setNums);

  const topThemes = topCounts(
    sets.map((s) => String(s.theme ?? "").trim()).filter(isNonEmptyString),
    4
  );

  const topYears = topCounts(
    sets.map((s) => (typeof s.year === "number" ? s.year : null)).filter((y): y is number => typeof y === "number"),
    3
  );

  const ownerName = normalizeUsername(d.owner_username || d.owner);
  const title = d.title?.trim() || `List #${d.id}`;
  const desc = d.description?.trim() || "";

  const count = typeof d.items_count === "number" ? d.items_count : setNums.length;

  const relatedOwner = ownerName || "";
  const relatedLists = relatedOwner
    ? await fetchRelatedListsSSR({ owner: relatedOwner, excludeId: d.id, limit: 9 })
    : [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{title}</h1>

            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {count} set{count === 1 ? "" : "s"}
              {ownerName ? (
                <span className="ml-2">
                  • by{" "}
                  <Link href={`/users/${encodeURIComponent(ownerName)}`} className="font-semibold hover:underline">
                    {ownerName}
                  </Link>
                </span>
              ) : null}
            </div>

            {desc ? <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{desc}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/lists/public"
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              ← Public lists
            </Link>
            <Link
              href="/discover"
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Browse sets →
            </Link>
          </div>
        </div>
      </div>

      {/* ✅ Internal links: lists → themes/years */}
      {topThemes.length > 0 || topYears.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
          <h2 className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Explore related pages</h2>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-500">Top themes in this list</div>
              {topThemes.length === 0 ? (
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">—</div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {topThemes.map(({ key, count }) => (
                    <Link
                      key={String(key)}
                      href={`/themes/${themeToSlug(String(key))}`}
                      className="inline-flex items-center gap-2 rounded-full border border-black/[.10] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
                    >
                      <span className="truncate">{String(key)}</span>
                      <span className="text-xs text-zinc-500">{count}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-500">Top years in this list</div>
              {topYears.length === 0 ? (
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">—</div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {topYears.map(({ key, count }) => (
                    <Link
                      key={String(key)}
                      href={`/years/${key}`}
                      className="inline-flex items-center gap-2 rounded-full border border-black/[.10] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
                    >
                      <span>{key}</span>
                      <span className="text-xs text-zinc-500">{count}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* ✅ Related lists */}
      {relatedLists.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-black/[.08] bg-white p-5 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-semibold">More lists by {ownerName ? `@${ownerName}` : "this user"}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Other public lists from the same creator.</p>
            </div>
            <Link href="/lists/public" className="text-sm font-semibold hover:underline">
              Browse all →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedLists.slice(0, 9).map((l) => {
              const id = String(l.id);
              const owner = normalizeUsername(l.owner) || "unknown";
              const count = typeof l.items_count === "number" ? l.items_count : 0;

              return (
                <div
                  key={id}
                  className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm hover:bg-zinc-50 dark:border-white/[.14] dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/lists/${encodeURIComponent(id)}`}
                        className="truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {l.title || `List #${id}`}
                      </Link>

                      <div className="mt-1 text-xs text-zinc-500">
                        by{" "}
                        <Link href={`/users/${encodeURIComponent(owner)}`} className="font-semibold hover:underline">
                          {owner}
                        </Link>
                        <span className="mx-2">•</span>
                        {count} set{count === 1 ? "" : "s"}
                      </div>
                    </div>

                    <Link
                      href={`/lists/${encodeURIComponent(id)}`}
                      className="shrink-0 text-sm font-semibold text-zinc-700 hover:underline dark:text-zinc-200"
                    >
                      →
                    </Link>
                  </div>

                  {l.description ? (
                    <p className="mt-3 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{l.description}</p>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">View list →</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ✅ Strong set links (Task 5) */}
      {sets.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => (
            <div
              key={s.set_num}
              className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm hover:bg-zinc-50 dark:border-white/[.14] dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <div className="flex gap-3">
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-50 dark:bg-white/5">
                  {s.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.image_url}
                      alt={s.name || s.set_num}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <Link
                    href={`/sets/${encodeURIComponent(s.set_num)}`}
                    className="block truncate text-sm font-semibold hover:underline"
                  >
                    {s.name || s.set_num}
                  </Link>

                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold">{s.set_num}</span>

                    {typeof s.year === "number" ? (
                      <>
                        <span className="mx-1">•</span>
                        <Link href={`/years/${s.year}`} className="font-semibold hover:underline">
                          {s.year}
                        </Link>
                      </>
                    ) : null}
                  </div>

                  {s.theme ? (
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      Theme:{" "}
                      <Link
                        href={`/themes/${themeToSlug(String(s.theme))}`}
                        className="font-semibold hover:underline"
                      >
                        {s.theme}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">No sets found in this list yet.</p>
      )}
    </div>
  );
}