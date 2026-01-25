// frontend_next/app/lists/[listId]/page.tsx
import type { Metadata } from "next";
import ListDetailClient from "./ListDetailClient";

const SITE_NAME = "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

type Params = { listId: string };

export async function generateMetadata({
  params,
}: {
  params: Params | Promise<Params>;
}): Promise<Metadata> {
  const { listId } = await Promise.resolve(params);
  const decoded = decodeURIComponent(listId);

  const title = `List ${decoded} | ${SITE_NAME}`;
  const description = `View LEGO list ${decoded}.`;

  const canonicalPath = `/lists/${encodeURIComponent(decoded)}`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const { listId } = await Promise.resolve(params);
  const decoded = decodeURIComponent(listId);

  return <ListDetailClient listId={decoded} />;
}