// frontend_next/app/pieces/most/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { apiBase } from "@/lib/api";
import { siteBase } from "@/lib/url";
import { asFiniteNumber, asTrimmedString, isRecord, pickRows, type UnknownRecord } from "@/lib/types";
import { safeImageSrc } from "@/lib/image";

export const revalidate = 3600;

type SetRow = {
  set_num: string;
  name: string;
  pieces?: number | null;
  year?: number | null;
  theme?: string | null;
  image_url?: string | null;
};

function coerceSetRow(x: unknown): SetRow | null {
  if (!isRecord(x)) return null;
  const set_num = asTrimmedString(x.set_num ?? x.setNum ?? x.set_number);
  const name = asTrimmedString(x.name);
  if (!set_num || !name) return null;

  const pieces = asFiniteNumber(x.pieces ?? x.num_parts);
  const year = asFiniteNumber(x.year);
  const theme = asTrimmedString(x.theme);
  const image_url = asTrimmedString(x.image_url);

  return {
    set_num,
    name,
    pieces: pieces != null ? Math.max(0, Math.floor(pieces)) : null,
    year: year != null ? Math.floor(year) : null,
    theme: theme ?? null,
    image_url: image_url ?? null,
  };
}

async function fetchMostPiecesSets(): Promise<SetRow[]> {
  const qs = new URLSearchParams();
  qs.set("page", "1");
  qs.set("limit", "60");
  qs.set("sort", "pieces");
  qs.set("order", "desc");

  const url = `${apiBase()}/sets?${qs.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  return pickRows(data).map(coerceSetRow).filter((r): r is SetRow => !!r);
}

const TITLE = "LEGO sets with the most pieces";
const DESCRIPTION = "Browse LEGO sets ranked by piece count (largest sets first).";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(siteBase()),
  alternates: { canonical: "/pieces/most" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/pieces/most", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export default async function Page() {
  const sets = await fetchMostPiecesSets();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="text-sm text-zinc-9000">
          <Link href="/" className="font-semibold hover:underline">
            Home
          </Link>
          <span className="mx-2">›</span>
          <span className="text-zinc-900">Most pieces</span>
        </div>

        <div className="mt-3">
          <h1 className="m-0 text-2xl font-semibold">{TITLE}</h1>
          <p className="mt-2 max-w-[720px] text-sm text-zinc-9000">{DESCRIPTION}</p>
        </div>
      </div>

      {sets.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-9000">No sets found yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => {
            const imgSrc = safeImageSrc(s.image_url);

            return (
              <div
                key={s.set_num}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300"
              >
                <div className="flex gap-3">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    {imgSrc ? (
                      <div className="relative h-20 w-24">
                        <Image
                          src={imgSrc}
                          alt={s.name || s.set_num}
                          fill
                          sizes="96px"
                          className="object-contain p-2"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-9000">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/sets/${encodeURIComponent(s.set_num)}`}
                      className="block truncate text-sm font-semibold hover:underline"
                    >
                      {s.name}
                    </Link>

                    <div className="mt-1 text-xs text-zinc-9000">
                      <span className="font-semibold">{s.set_num}</span>
                      {typeof s.pieces === "number" ? (
                        <>
                          <span className="mx-1">•</span>
                          <span>{s.pieces.toLocaleString()} pcs</span>
                        </>
                      ) : null}
                      {typeof s.year === "number" ? (
                        <>
                          <span className="mx-1">•</span>
                          <span>{s.year}</span>
                        </>
                      ) : null}
                    </div>

                    {s.theme ? (
                      <div className="mt-1 text-xs text-zinc-9000">Theme: {s.theme}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10">
        <Link
          href="/"
          className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
        >
          ← Home
        </Link>
      </div>
    </div>
  );
}