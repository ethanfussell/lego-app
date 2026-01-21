// frontend_next/app/search/page.tsx
import SearchClient from "./SearchClient";

export default function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qRaw = searchParams?.q;
  const sortRaw = searchParams?.sort;
  const pageRaw = searchParams?.page;

  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw || "").trim();
  const sort = (Array.isArray(sortRaw) ? sortRaw[0] : sortRaw || "relevance").trim();
  const pageNum = Number(Array.isArray(pageRaw) ? pageRaw[0] : pageRaw || "1");
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return <SearchClient initialQ={q} initialSort={sort} initialPage={page} />;
}