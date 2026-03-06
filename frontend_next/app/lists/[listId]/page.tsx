// frontend_next/app/lists/[listId]/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { themeToSlug } from "@/lib/slug";
import { apiBase } from "@/lib/api";
import { siteBase, SITE_NAME } from "@/lib/url";
import { getFiniteNumber as getNumber, getTrimmedString as getString, isRecord, type UnknownRecord, type SetLite } from "@/lib/types";
import { safeImageSrc } from "@/lib/image";

export const dynamic = "force-static";
export const revalidate = 3600;

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

type PublicListRow = {
  id: number;
  title: string;
  description: string | null;
  owner: string;
  items_count: number;
  created_at?: string | null;
  updated_at?: string | null;
};

function notNull<T>(v: T | null | undefined): v is T {
  return v != null;
}

function getTrimmedString(o: UnknownRecord, key: string): string | null {
  const v = getString(o, key);
  return v && v.trim() ? v.trim() : null;
}

function getBoolean(o: UnknownRecord, key: string, fallback = false): boolean {
  const v = o[key];
  return typeof v === "boolean" ? v : fallback;
}

function coerceListDetail(x: unknown): ListDetail | null {
  if (!isRecord(x)) return null;

  const id = getNumber(x, "id");
  if (typeof id !== "number") return null;

  const title = getString(x, "title");
  const description = getString(x, "description");
  const is_public = getBoolean(x, "is_public", false);

  const owner = getString(x, "owner");
  const owner_username = getString(x, "owner_username");

  const items_count = (() => {
    const n = getNumber(x, "items_count");
    return typeof n === "number" ? Math.floor(n) : null;
  })();

  const created_at = getTrimmedString(x, "created_at");
  const updated_at = getTrimmedString(x, "updated_at");

  const items = (() => {
    const raw = x.items;
    if (!Array.isArray(raw)) return null;

    return raw
      .filter(isRecord)
      .map((it) => ({ set_num: String(it.set_num ?? "").trim() }))
      .filter((it) => it.set_num.length > 0);
  })();

  const set_nums = (() => {
    const raw = x.set_nums;
    if (!Array.isArray(raw)) return null;
    return raw.map((s) => String(s ?? "").trim()).filter(Boolean);
  })();

  return {
    id,
    title: title && title.trim() ? title.trim() : null,
    description: description && description.trim() ? description.trim() : null,
    is_public,
    owner: owner && owner.trim() ? owner.trim() : null,
    owner_username: owner_username && owner_username.trim() ? owner_username.trim() : null,
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

function coerceSetLite(x: unknown): SetLite | null {
  if (!isRecord(x)) return null;

  const sn = getTrimmedString(x, "set_num");
  if (!sn) return null;

  const name = getTrimmedString(x, "name");
  const year = getNumber(x, "year") ?? undefined;
  const pieces = getNumber(x, "pieces") ?? undefined;
  const theme = getTrimmedString(x, "theme") ?? undefined;
  const image_url = getTrimmedString(x, "image_url");

  return {
    set_num: sn,
    ...(name ? { name } : {}),
    ...(typeof year === "number" ? { year } : {}),
    ...(typeof pieces === "number" ? { pieces } : {}),
    ...(theme ? { theme } : {}),
    image_url: image_url ?? null,
  };
}

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

  const arr = (data as unknown[]).map(coerceSetLite).filter((v): v is SetLite => !!v);

  const byNum = new Map(arr.map((s) => [s.set_num, s]));
  return capped.map((n) => byNum.get(n)).filter((v): v is SetLite => !!v);
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

function coercePublicListRow(o: unknown): PublicListRow | null {
  if (!isRecord(o)) return null;

  const id = getNumber(o, "id");
  if (typeof id !== "number") return null;

  const tRaw = getTrimmedString(o, "title");
  const title = tRaw || `List #${id}`;

  const ownerName = getTrimmedString(o, "owner_username") || getTrimmedString(o, "owner") || "unknown";

  const items_count = (() => {
    const n = getNumber(o, "items_count");
    return typeof n === "number" ? Math.max(0, Math.floor(n)) : 0;
  })();

  const description = (() => {
    const d = getString(o, "description");
    return d && d.trim() ? d.trim() : null;
  })();

  const created_at = getTrimmedString(o, "created_at");
  const updated_at = getTrimmedString(o, "updated_at");

  return { id, title, description, owner: ownerName, items_count, created_at, updated_at };
}

async function fetchMoreListsByOwnerSSR(opts: { owner: string; excludeId: number; limit?: number }): Promise<PublicListRow[]> {
  const owner = String(opts.owner || "").trim();
  if (!owner) return [];

  const qs = new URLSearchParams();
  qs.set("owner", owner);
  qs.set("sort", "updated_desc");
  qs.set("page", "1");
  qs.set("limit", String(Math.max(1, Math.min(25, (opts.limit ?? 6) + 6))));

  const url = `${apiBase()}/lists/public?${qs.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  const raw: unknown[] = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.results)
      ? (data.results as unknown[])
      : [];

  const rows = raw.map(coercePublicListRow).filter(notNull);
  return rows.filter((r) => r.id !== opts.excludeId).slice(0, Math.max(1, Math.min(12, opts.limit ?? 6)));
}

async function fetchRelatedListsByThemeSSR(opts: { theme: string; excludeId: number; limit?: number }): Promise<PublicListRow[]> {
  const theme = String(opts.theme || "").trim();
  if (!theme) return [];

  const qs = new URLSearchParams();
  qs.set("theme", theme);
  qs.set("sort", "count_desc");
  qs.set("page", "1");
  qs.set("limit", String(Math.max(1, Math.min(25, (opts.limit ?? 9) + 6))));

  const url = `${apiBase()}/lists/public?${qs.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  const raw: unknown[] = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.results)
      ? (data.results as unknown[])
      : [];

  const rows = raw.map(coercePublicListRow).filter(notNull);
  return rows.filter((r) => r.id !== opts.excludeId).slice(0, Math.max(1, Math.min(12, opts.limit ?? 9)));
}

// ---- Metadata ----

function defaultOgImagePath() {
  return "/opengraph-image";
}

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);

  const safeId = normalized ?? "list";
  const canonicalPath = canonicalForList(safeId);

  const ogImage = defaultOgImagePath(); // ✅ site-wide default OG
  const ogImageMeta = [{ url: ogImage, width: 1200, height: 630, alt: SITE_NAME }];

  if (!normalized) {
    const title = `List not found`;
    const description = "This list does not exist.";
    return {
      title,
      description,
      metadataBase: new URL(siteBase()),
      alternates: { canonical: canonicalPath },
      robots: { index: false, follow: false },
      openGraph: { title, description, url: canonicalPath, type: "website", images: ogImageMeta },
      twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    };
  }

  const d = await fetchPublicListSSR(normalized);

  if (d === "notfound" || d === "private") {
    const title = `List ${normalized} not found | ${SITE_NAME}`;
    const description = "This list does not exist or is private.";
    return {
      title,
      description,
      metadataBase: new URL(siteBase()),
      alternates: { canonical: canonicalPath },
      robots: { index: false, follow: false },
      openGraph: { title, description, url: canonicalPath, type: "website", images: ogImageMeta },
      twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    };
  }

  const ownerName = normalizeUsername(d.owner_username || d.owner);
  const count =
    typeof d.items_count === "number" && Number.isFinite(d.items_count) ? Math.max(0, Math.floor(d.items_count)) : 0;

  const listTitle = (d.title && d.title.trim()) || `List #${d.id}`;
  const title = ownerName ? `${listTitle} by @${ownerName}` : `${listTitle}`;

  const desc = (d.description && d.description.trim()) || "";
  const fallback = ownerName
    ? `Public LEGO list by @${ownerName}. ${count ? `${count} set${count === 1 ? "" : "s"}.` : ""}`.trim()
    : `Public LEGO list. ${count ? `${count} set${count === 1 ? "" : "s"}.` : ""}`.trim();

  const description = desc.length >= 40 ? desc : desc ? `${desc} — ${fallback}` : fallback;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath, type: "website", images: ogImageMeta },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

// ---- Page ----

export default async function Page({ params }: { params: Params | Promise<Params> }) {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);
  if (!normalized) notFound();

  const d = await fetchPublicListSSR(normalized);
  if (d === "notfound" || d === "private") notFound();

  const setNums = toSetNums(d);
  const sets = await fetchSetsBulkSSR(setNums);

  const topThemes = topCounts(sets.map((s) => String(s.theme ?? "").trim()).filter(isNonEmptyString), 4);

  const topYears = topCounts(
    sets.map((s) => (typeof s.year === "number" ? s.year : null)).filter((y): y is number => typeof y === "number"),
    3
  );

  const ownerName = normalizeUsername(d.owner_username || d.owner);
  const title = d.title?.trim() || `List #${d.id}`;
  const desc = d.description?.trim() || "";

  const count = typeof d.items_count === "number" ? d.items_count : setNums.length;

  const moreByOwner = ownerName ? await fetchMoreListsByOwnerSSR({ owner: ownerName, excludeId: d.id, limit: 6 }) : [];
  const relatedTheme = topThemes[0]?.key ? String(topThemes[0].key) : "";
  const relatedByTheme = relatedTheme ? await fetchRelatedListsByThemeSSR({ theme: relatedTheme, excludeId: d.id, limit: 9 }) : [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{title}</h1>

            <div className="mt-2 text-sm text-zinc-500">
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

            {desc ? <p className="mt-3 max-w-2xl text-sm text-zinc-500">{desc}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/lists/public"
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              ← Public lists
            </Link>
            <Link
              href="/discover"
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Browse sets →
            </Link>
          </div>
        </div>
      </div>

      {/* Strong set links */}
      {sets.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => {
            const imgSrc = safeImageSrc(s.image_url);

            return (
              <div
                key={s.set_num}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300 hover:bg-zinc-100"
              >
                <div className="flex gap-3">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    {imgSrc ? (
                      <div className="relative h-20 w-24">
                        <Image
                          src={imgSrc}
                          alt={s.name || s.set_num}
                          fill
                          sizes="96px"
                          className="object-contain p-2"
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/sets/${encodeURIComponent(s.set_num)}`}
                      className="block truncate text-sm font-semibold hover:underline"
                    >
                      {s.name || s.set_num}
                    </Link>

                    <div className="mt-1 text-xs text-zinc-500">
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
                      <div className="mt-1 text-xs text-zinc-500">
                        Theme:{" "}
                        <Link href={`/themes/${themeToSlug(String(s.theme))}`} className="font-semibold hover:underline">
                          {s.theme}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-8 text-sm text-zinc-500">No sets found in this list yet.</p>
      )}
    </div>
  );
}