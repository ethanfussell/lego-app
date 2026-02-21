// frontend_next/app/lists/[listId]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ListDetailClient from "./ListDetailClient";
import { slugToTheme, themeToSlug } from "@/lib/slug"; // (ok if unused; remove if your linter complains)

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

type Params = { listId: string };

type ListItem = { set_num: string; added_at?: string; position?: number };

type ListDetail = {
  id: number;
  title?: string | null;
  description?: string | null;
  is_public?: boolean | null;
  is_system?: boolean | null;
  system_key?: string | null;
  items_count?: number | null;

  owner?: string | null;
  owner_username?: string | null;
  username?: string | null;

  items?: ListItem[] | null;
  set_nums?: string[] | null;
};

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  num_parts?: number;
  image_url?: string | null;
  theme?: string;
};

function normalizeListId(raw: string): string | null {
  const decoded = decodeURIComponent(raw).trim();
  if (!/^\d+$/.test(decoded)) return null;

  const n = Number(decoded);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  if (n > 2147483647) return null;

  return decoded;
}

function ownerName(detail: ListDetail | null): string {
  if (!detail) return "";
  return String(detail.owner_username || detail.owner || detail.username || "").trim();
}

function toSetNums(detail: ListDetail | null): string[] {
  if (!detail) return [];
  if (Array.isArray(detail.set_nums)) return detail.set_nums.map((x) => String(x || "").trim()).filter(Boolean);
  if (Array.isArray(detail.items)) return detail.items.map((it) => String(it?.set_num || "").trim()).filter(Boolean);
  return [];
}

// Fetch list detail (public)
async function fetchListPublic(listId: string): Promise<ListDetail | null> {
  const url = `${apiBase()}/lists/${encodeURIComponent(listId)}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (res.status === 404) return null;

  // If backend returns 401/403 for private lists, treat as "not publicly viewable"
  if (res.status === 401 || res.status === 403) return null;

  if (!res.ok) return null;

  const data: unknown = await res.json().catch(() => null);
  if (!data || typeof data !== "object") return null;

  return data as ListDetail;
}

// Fetch bulk set cards for the list (public)
async function fetchSetsBulkPublic(setNums: string[]): Promise<SetLite[]> {
  const nums = Array.from(new Set((setNums || []).map((s) => String(s || "").trim()).filter(Boolean)));
  if (nums.length === 0) return [];

  const params = new URLSearchParams();
  params.set("set_nums", nums.join(","));

  const url = `${apiBase()}/sets/bulk?${params.toString()}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  const arr = Array.isArray(data) ? (data as unknown[]) : [];

  const rows = arr.filter((x): x is SetLite => {
    return typeof x === "object" && x !== null && typeof (x as any).set_num === "string";
  });

  const byNum = new Map(rows.map((s) => [String(s.set_num), s]));
  return nums.map((n) => byNum.get(n)).filter((v): v is SetLite => !!v);
}

// ✅ Make cacheable
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);
  if (!normalized) {
    return {
      title: `List`,
      description: `View LEGO list.`,
      metadataBase: new URL(siteBase()),
      alternates: { canonical: "/lists" },
    };
  }

  // Try to fetch public list for better titles
  const detail = await fetchListPublic(normalized);
  const titleText = detail?.title?.trim() ? detail.title!.trim() : `List ${normalized}`;
  const owner = ownerName(detail);
  const desc =
    detail?.description?.trim()
      ? detail.description!.trim()
      : owner
        ? `Public LEGO list by ${owner}.`
        : `Public LEGO list.`;

  const canonicalPath = `/lists/${encodeURIComponent(normalized)}`;

  return {
    title: `${titleText} | ${SITE_NAME}`,
    description: desc,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title: `${titleText} | ${SITE_NAME}`, description: desc, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title: `${titleText} | ${SITE_NAME}`, description: desc },
  };
}

export default async function Page({ params }: { params: Params | Promise<Params> }) {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);
  if (!normalized) notFound();

  // ✅ Server-render the public view (if possible)
  const detail = await fetchListPublic(normalized);

  // If it doesn't exist at all, 404.
  // If it's private, we don't know if it exists, so we show client shell instead of 404.
  // (This avoids leaking private list existence.)
  const isPublic = !!detail?.is_public;

  let initialSets: SetLite[] = [];
  if (detail && isPublic) {
    const nums = toSetNums(detail);
    initialSets = await fetchSetsBulkPublic(nums);
  }

  return (
    <ListDetailClient
      listId={normalized}
      initialDetail={detail}
      initialSets={initialSets}
    />
  );
}