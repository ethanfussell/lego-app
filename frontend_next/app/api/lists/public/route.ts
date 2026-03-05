// frontend_next/app/api/lists/public/route.ts
import { NextResponse } from "next/server";
import { apiBase } from "@/lib/api";
import { getFiniteNumber as getNumber, getTrimmedString as getString, isRecord, type UnknownRecord } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 3600;

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

function getBoolean(o: UnknownRecord, key: string): boolean | null {
  const v = o[key];
  return typeof v === "boolean" ? v : null;
}

function normalizeRow(x: unknown): PublicListRow | null {
  if (!isRecord(x)) return null;

  const id = getNumber(x, "id");
  if (id == null) return null;

  const title = getString(x, "title") || "Untitled list";

  // Allow null but don't turn undefined into "undefined"
  const descriptionRaw = x["description"];
  const description =
    typeof descriptionRaw === "string" ? descriptionRaw : descriptionRaw == null ? null : String(descriptionRaw);

  const owner = getString(x, "owner") || "unknown";

  const items_count = (() => {
    const n = getNumber(x, "items_count");
    return n == null ? 0 : Math.max(0, Math.floor(n));
  })();

  const created_at = getString(x, "created_at");
  const updated_at = getString(x, "updated_at");

  // public endpoint should only return public lists; default true if missing
  const is_public = getBoolean(x, "is_public") ?? true;

  return {
    id: Math.floor(id),
    title,
    description,
    owner,
    items_count,
    created_at,
    updated_at,
    is_public,
  };
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
  const arr: unknown[] = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data["results"])
      ? (data["results"] as unknown[])
      : [];

  return arr.map(normalizeRow).filter((x): x is PublicListRow => Boolean(x));
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