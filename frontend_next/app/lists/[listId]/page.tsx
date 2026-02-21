// frontend_next/app/lists/[listId]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ListDetailClient from "./ListDetailClient";
import { themeToSlug } from "@/lib/slug";

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
  if (n > 2147483647) return null; // keep strict for now
  return decoded;
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceListDetail(x: unknown): ListDetail | null {
  if (!isRecord(x)) return null;
  const id = x.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;

  const title = typeof x.title === "string" ? x.title : x.title == null ? null : String(x.title);
  const description =
    typeof x.description === "string" ? x.description : x.description == null ? null : String(x.description);

  const is_public = typeof x.is_public === "boolean" ? x.is_public : false;

  const owner = typeof x.owner === "string" ? x.owner : x.owner == null ? null : String(x.owner);
  const owner_username =
    typeof x.owner_username === "string" ? x.owner_username : x.owner_username == null ? null : String(x.owner_username);

  const items_count =
    typeof x.items_count === "number" && Number.isFinite(x.items_count) ? Math.floor(x.items_count) : null;

  const created_at = typeof x.created_at === "string" ? x.created_at : null;
  const updated_at = typeof x.updated_at === "string" ? x.updated_at : null;

  const items = Array.isArray(x.items) ? (x.items as any[]).filter(isRecord).map((it) => ({ set_num: String(it.set_num || "") })) : null;
  const set_nums = Array.isArray(x.set_nums) ? (x.set_nums as any[]).map((s) => String(s || "")).filter(Boolean) : null;

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

async function fetchPublicListSSR(id: string): Promise<ListDetail | "notfound" | "private"> {
  const url = `${apiBase()}/lists/${encodeURIComponent(id)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
  } catch {
    // treat as notfound so we don't publish a broken page
    return "notfound";
  }

  if (res.status === 404) return "notfound";
  if (res.status === 401 || res.status === 403) return "private";
  if (!res.ok) return "notfound";

  const data: unknown = await res.json().catch(() => null);
  const d = coerceListDetail(data);
  if (!d) return "notfound";

  // If backend returns a private list without auth, also treat as private.
  if (!d.is_public) return "private";

  return d;
}

async function fetchSetsBulkSSR(setNums: string[]): Promise<SetLite[]> {
  const nums = Array.from(new Set(setNums.map((s) => String(s || "").trim()).filter(Boolean)));
  if (nums.length === 0) return [];

  // cap SSR so we don't build huge HTML
  const capped = nums.slice(0, 60);

  const params = new URLSearchParams();
  params.set("set_nums", capped.join(","));

  const url = `${apiBase()}/sets/bulk?${params.toString()}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  if (!Array.isArray(data)) return [];

  const arr = (data as unknown[])
    .filter(isRecord)
    .filter((x) => typeof x.set_num === "string" && String(x.set_num).trim())
    .map((x) => ({
      set_num: String(x.set_num),
      name: typeof x.name === "string" ? x.name : undefined,
      year: typeof x.year === "number" ? x.year : undefined,
      pieces: typeof x.pieces === "number" ? x.pieces : undefined,
      theme: typeof x.theme === "string" ? x.theme : undefined,
      image_url: typeof x.image_url === "string" ? x.image_url : null,
    })) as SetLite[];

  const byNum = new Map(arr.map((s) => [s.set_num, s]));
  return capped.map((n) => byNum.get(n)).filter((v): v is SetLite => !!v);
}

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);

  const safeId = normalized ?? "list";
  const canonicalPath = canonicalForList(safeId);

  // Keep metadata stable even if list fetch fails
  return {
    title: `List ${safeId} | ${SITE_NAME}`,
    description: `View LEGO list ${safeId}.`,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title: `List ${safeId} | ${SITE_NAME}`, description: `View LEGO list ${safeId}.`, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title: `List ${safeId} | ${SITE_NAME}`, description: `View LEGO list ${safeId}.` },
  };
}

export default async function Page({ params }: { params: Params | Promise<Params> }) {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);
  if (!normalized) notFound();

  const d = await fetchPublicListSSR(normalized);
  if (d === "notfound") notFound();
  if (d === "private") notFound(); // don't index private lists

  const setNums = toSetNums(d);
  const sets = await fetchSetsBulkSSR(setNums);

  const ownerName = (d.owner_username || d.owner || "").trim();
  const title = d.title?.trim() || `List #${d.id}`;
  const desc = d.description?.trim() || "";

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{title}</h1>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {typeof d.items_count === "number" ? `${d.items_count} set${d.items_count === 1 ? "" : "s"}` : `${setNums.length} sets`}
              {ownerName ? <span className="ml-2">• by <span className="font-semibold">{ownerName}</span></span> : null}
            </div>
            {desc ? <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{desc}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/lists/public" className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]">
              ← Public lists
            </Link>
            <Link href="/discover" className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]">
              Browse sets →
            </Link>
          </div>
        </div>
      </div>

      {/* SSR: strong internal links to sets */}
      {sets.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => (
            <Link
              key={s.set_num}
              href={`/sets/${encodeURIComponent(s.set_num)}`}
              className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm hover:bg-zinc-50 dark:border-white/[.14] dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <div className="flex gap-3">
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-50 dark:bg-white/5">
                  {s.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image_url} alt={s.name || s.set_num} className="h-full w-full object-contain p-2" loading="lazy" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{s.name || s.set_num}</div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold">{s.set_num}</span>
                    {typeof s.year === "number" ? (
                      <>
                        <span className="mx-1">•</span>
                        <Link href={`/years/${s.year}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
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
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.theme}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">No sets found in this list yet.</p>
      )}

      {/* Client: optional enhancements (copy link, edit if logged in, etc) */}
      <div className="mt-10">
        <ListDetailClient listId={normalized} initialDetail={d} initialSets={sets} />
      </div>
    </div>
  );
}