// frontend_next/app/lists/[listId]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ListDetailClient from "./ListDetailClient";

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

type ListDetail = {
  id: number | string;
  title?: string | null;
  description?: string | null;
  is_public?: boolean | null;
  is_system?: boolean | null;
  system_key?: string | null;
  items_count?: number | null;

  owner?: string | null;
  owner_username?: string | null;
  username?: string | null;

  items?: Array<{ set_num: string; added_at?: string; position?: number }> | null;
  set_nums?: string[] | null;
};

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  image_url?: string | null;
  theme?: string;
};

function normalizeListId(raw: string): string | null {
  const decoded = decodeURIComponent(raw).trim();
  if (!/^\d+$/.test(decoded)) return null;

  const n = Number(decoded);
  if (!Number.isSafeInteger(n)) return null;
  if (n <= 0) return null;
  if (n > 2147483647) return null; // int32 guard
  return decoded;
}

function toSetNums(detail: ListDetail | null | undefined): string[] {
  if (!detail) return [];
  if (Array.isArray(detail.set_nums)) {
    return detail.set_nums.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (Array.isArray(detail.items)) {
    return detail.items.map((it) => String(it?.set_num || "").trim()).filter(Boolean);
  }
  return [];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isListDetail(x: unknown): x is ListDetail {
  if (!isRecord(x)) return false;
  // require id
  const id = x.id;
  return typeof id === "number" || (typeof id === "string" && id.trim().length > 0);
}

function isSetLite(x: unknown): x is SetLite {
  if (!isRecord(x)) return false;
  const sn = x.set_num;
  return typeof sn === "string" && sn.trim().length > 0;
}

async function fetchPublicListDetail(id: string): Promise<ListDetail | "notfound" | "forbidden" | "degraded"> {
  const url = `${apiBase()}/lists/${encodeURIComponent(id)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      next: { revalidate },
    });
  } catch {
    return "degraded";
  }

  if (res.status === 404) return "notfound";
  if (res.status === 401 || res.status === 403) return "forbidden";
  if (!res.ok) return "degraded";

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return "degraded";
  }

  return isListDetail(data) ? data : "degraded";
}

async function fetchSetsBulk(setNums: string[]): Promise<SetLite[]> {
  const nums = Array.from(new Set((setNums || []).map((s) => String(s || "").trim()).filter(Boolean)));
  if (nums.length === 0) return [];

  const qs = new URLSearchParams();
  qs.set("set_nums", nums.join(","));

  const url = `${apiBase()}/sets/bulk?${qs.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      next: { revalidate },
    });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return [];
  }

  const arr = Array.isArray(data) ? data.filter(isSetLite) : [];
  const byNum = new Map(arr.map((s) => [String(s.set_num), s]));
  return nums.map((n) => byNum.get(n)).filter((v): v is SetLite => !!v);
}

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);

  const safeId = normalized ?? "list";
  const title = `List ${safeId}`;
  const description = `View LEGO list ${safeId}.`;
  const canonicalPath = `/lists/${encodeURIComponent(safeId)}`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title: `${title} | ${SITE_NAME}`, description },
  };
}

export default async function Page({ params }: { params: Params | Promise<Params> }) {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);
  if (!normalized) notFound();

  const detailResult = await fetchPublicListDetail(normalized);

  if (detailResult === "notfound") notFound();

  // If private/forbidden, treat as notFound for crawlers (no leaking)
  if (detailResult === "forbidden") notFound();

  // degraded: still render a page shell with empty list so it can cache
  const initialDetail: ListDetail | null = detailResult === "degraded" ? null : detailResult;

  const setNums = toSetNums(initialDetail);
  const initialSets = await fetchSetsBulk(setNums);

  const initialError =
    detailResult === "degraded" ? "Couldn’t load this list right now. Try again in a moment." : null;

  return (
    <ListDetailClient
      listId={normalized}
      initialDetail={initialDetail}
      initialSets={initialSets}
      initialError={initialError}
    />
  );
}