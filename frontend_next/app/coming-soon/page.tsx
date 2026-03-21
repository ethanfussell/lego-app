// frontend_next/app/coming-soon/page.tsx
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import ComingSoonClient from "./ComingSoonClient";
import { siteBase } from "@/lib/url";
import { isRecord, type SetLite } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coming Soon",
  description:
    "Upcoming LEGO sets — browse new releases before they hit shelves.",
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/coming-soon" },
  openGraph: {
    title: "Coming Soon",
    description:
      "Upcoming LEGO sets — browse new releases before they hit shelves.",
    url: "/coming-soon",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Coming Soon",
    description:
      "Upcoming LEGO sets — browse new releases before they hit shelves.",
  },
};

function isSetLite(x: unknown): x is SetLite {
  return isRecord(x) && typeof x.set_num === "string";
}

function toSetLiteArray(x: unknown): SetLite[] {
  return Array.isArray(x) ? x.filter(isSetLite) : [];
}

async function fetchComingSoonSets(): Promise<SetLite[]> {
  const raw = await apiFetch<unknown>("/sets/coming-soon?limit=200", {
    cache: "no-store",
  });
  if (Array.isArray(raw)) return toSetLiteArray(raw);
  if (isRecord(raw) && Array.isArray(raw.results))
    return toSetLiteArray(raw.results);
  return [];
}

export default async function Page() {
  let sets: SetLite[] = [];
  let error: string | null = null;

  try {
    sets = await fetchComingSoonSets();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }

  return <ComingSoonClient initialSets={sets} initialError={error} />;
}
