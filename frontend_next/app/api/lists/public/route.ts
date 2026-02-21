// frontend_next/app/api/lists/public/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

type BackendRow = {
  id: number;
  title?: string | null;
  description?: string | null;
  owner?: string | null;
  items_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_public?: boolean | null;
  // other fields may exist; we ignore them
};

type PublicListRow = {
  id: number;
  title: string;
  description: string | null;
  owner: string;
  items_count: number;
  created_at: string | null;
  updated_at: string | null;
  is_public: boolean;
};

type SortKey = "updated_desc" | "count_desc" | "name_asc";

// ---- helpers
function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function toInt(raw: string | null, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clampInt(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function normText(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

function parseSort(raw: string | null): SortKey {
  const s = String(raw ?? "").trim();
  if (s === "count_desc" || s === "name_asc" || s === "updated_desc") return s;
  return "updated_desc";
}

function pickUpdatedTs(r: PublicListRow) {
  const s = (r.updated_at || r.created_at || "").trim();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function normalizeRow(x: any): PublicListRow | null {
  const id = x?.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;

  const title = String(x?.title ?? "").trim() || "Untitled list";
  const description = x?.description != null ? String(x.description) : null;
  const owner = String(x?.owner ?? "").trim() || "unknown";
  const items_count = typeof x?.items_count === "number" && Number.isFinite(x.items_count) ? Math.max(0, Math.floor(x.items_count)) : 0;

  const created_at = x?.created_at != null ? String(x.created_at) : null;
  const updated_at = x?.updated_at != null ? String(x.updated_at) : null;

  const is_public = typeof x?.is_public === "boolean" ? x.is_public : true;

  return { id, title, description, owner, items_count, created_at, updated_at, is_public };
}

function applyQ(rows: PublicListRow[], qRaw: string) {
  const q = normText(qRaw);
  if (!q) return rows;

  return rows.filter((r) => {
    const hay = `${r.title} ${r.description ?? ""} ${r.owner}`.toLowerCase();
    return hay.includes(q);
  });
}

function applySort(rows: PublicListRow[], sort: SortKey) {
  const copy = [...rows];

  if (sort === "name_asc") {
    copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    return copy;
  }

  if (sort === "count_desc") {
    copy.sort((a, b) => b.items_count - a.items_count || pickUpdatedTs(b) - pickUpdatedTs(a));
    return copy;
  }

  // updated_desc
  copy.sort((a, b) => pickUpdatedTs(b) - pickUpdatedTs(a) || b.items_count - a.items_count);
  return copy;
}

async function fetchFromBackend(owner: string): Promise<PublicListRow[]> {
  const qs = new URLSearchParams();
  if (owner) qs.set("owner", owner);

  const url = `${apiBase()}/lists/public${qs.toString() ? `?${qs.toString()}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  const arr: unknown[] = Array.isArray(data) ? (data as unknown[]) : [];

  return arr
    .map((x) => normalizeRow(x))
    .filter((x): x is PublicListRow => !!x);
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const owner = String(url.searchParams.get("owner") ?? "").trim();
  const q = String(url.searchParams.get("q") ?? "").trim();
  const sort = parseSort(url.searchParams.get("sort"));

  const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
  const limit = clampInt(toInt(url.searchParams.get("limit"), 24), 6, 60);

  // 1) backend
  const base = await fetchFromBackend(owner);

  // 2) q filter
  const filtered = applyQ(base, q);

  // 3) sort
  const sorted = applySort(filtered, sort);

  // 4) paginate
  const total = sorted.length;
  const total_pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const safePage = Math.min(page, total_pages);

  const start = (safePage - 1) * limit;
  const end = start + limit;
  const results = sorted.slice(start, end);

  return NextResponse.json(
    { results, total, total_pages, page: safePage, limit, sort, owner, q },
    {
      headers: {
        "cache-control": "public, max-age=0, must-revalidate",
        "x-total-count": String(total),
      },
    }
  );
}