// frontend_next/app/lists/public/page.tsx
import type { Metadata } from "next";
import PublicListsClient from "./PublicListsClient";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

export const revalidate = 3600; // ISR

type PublicListRow = {
  id: string | number;
  name?: string | null;
  description?: string | null;
  owner?: string | null;
  username?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  set_count?: number | null;
  item_count?: number | null;
  sets?: Array<{ set_num: string }> | string[]; // tolerate shapes
};

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function toArray(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

function normalizeLists(x: unknown): PublicListRow[] {
  if (Array.isArray(x)) return x as PublicListRow[];
  if (typeof x === "object" && x !== null) {
    const r = (x as { results?: unknown }).results;
    return Array.isArray(r) ? (r as PublicListRow[]) : [];
  }
  return [];
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Public Lists | ${SITE_NAME}`,
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
}

async function fetchPublicLists(owner?: string) {
  const qs = new URLSearchParams();
  if (owner) qs.set("owner", owner);

  const url = `${apiBase()}/lists/public${qs.toString() ? `?${qs.toString()}` : ""}`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return { rows: [] as PublicListRow[], error: `HTTP ${res.status}` };

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    return { rows: [] as PublicListRow[], error: "Bad JSON" };
  }

  const rows = normalizeLists(data).filter((r) => r && (r as any).id != null);
  return { rows, error: null as string | null };
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const ownerRaw = Array.isArray(sp.owner) ? sp.owner[0] : sp.owner;
  const owner = String(ownerRaw ?? "").trim() || "";

  const { rows, error } = await fetchPublicLists(owner || undefined);

  return <PublicListsClient initialOwner={owner} initialLists={rows} initialError={error} />;
}