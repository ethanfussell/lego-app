// frontend_next/app/lists/[listId]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ListDetailClient from "./ListDetailClient";

const SITE_NAME = "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

type Params = { listId: string };

// Keep this strict for the “9999999999 -> 500” case.
// If your backend truly supports huge IDs, remove the int32 check later.
function normalizeListId(raw: string): string | null {
  const decoded = decodeURIComponent(raw).trim();

  // digits only
  if (!/^\d+$/.test(decoded)) return null;

  const n = Number(decoded);

  // avoid weird values / unsafe ints
  if (!Number.isSafeInteger(n)) return null;
  if (n <= 0) return null;

  // common backend constraint (int32); prevents the 500 you saw
  if (n > 2147483647) return null;

  return decoded;
}

export async function generateMetadata({
  params,
}: {
  params: Params | Promise<Params>;
}): Promise<Metadata> {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);

  // If invalid, still return something sane; page will notFound().
  const safe = normalized ?? "list";

  const title = `List ${safe} | ${SITE_NAME}`;
  const description = `View LEGO list ${safe}.`;
  const canonicalPath = `/lists/${encodeURIComponent(safe)}`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const { listId } = await Promise.resolve(params);
  const normalized = normalizeListId(listId);

  if (!normalized) notFound();

  return <ListDetailClient listId={normalized} />;
}