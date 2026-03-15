import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { apiBase } from "@/lib/api";
import { siteBase } from "@/lib/url";
import { asFiniteNumber, asTrimmedString, isRecord, pickRows } from "@/lib/types";
import { safeImageSrc } from "@/lib/image";

export const revalidate = 3600;

type SetRow = {
  set_num: string;
  name: string;
  pieces?: number | null;
  year?: number | null;
  theme?: string | null;
  image_url?: string | null;
  retail_price?: number | null;
};

function coerceSetRow(x: unknown): SetRow | null {
  if (!isRecord(x)) return null;
  const set_num = asTrimmedString(x.set_num ?? x.setNum ?? x.set_number);
  const name = asTrimmedString(x.name);
  if (!set_num || !name) return null;

  return {
    set_num,
    name,
    pieces: asFiniteNumber(x.pieces ?? x.num_parts) ?? null,
    year: asFiniteNumber(x.year) ?? null,
    theme: asTrimmedString(x.theme) ?? null,
    image_url: asTrimmedString(x.image_url) ?? null,
    retail_price: asFiniteNumber(x.retail_price) ?? null,
  };
}

async function fetchAffordableSets(maxPrice: number): Promise<{ sets: SetRow[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("page", "1");
  qs.set("limit", "60");
  qs.set("max_price", String(maxPrice));
  qs.set("availability", "available,retiring_soon");
  qs.set("sort", "price");
  qs.set("order", "asc");

  let res: Response;
  try {
    res = await fetch(`${apiBase()}/sets?${qs}`, {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
  } catch {
    return { sets: [], total: 0 };
  }

  if (!res.ok) return { sets: [], total: 0 };

  const total = asFiniteNumber(res.headers.get("x-total-count")) ?? 0;
  const data: unknown = await res.json().catch(() => null);
  const sets = pickRows(data).map(coerceSetRow).filter((r): r is SetRow => !!r);
  return { sets, total };
}

type Props = { searchParams: Promise<{ max?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { max } = await searchParams;
  const maxPrice = asFiniteNumber(max) ?? 100;
  const title = `LEGO Sets Under $${maxPrice}`;
  const description = `Browse affordable LEGO sets priced under $${maxPrice}.`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: "/affordable" },
    openGraph: { title, description, url: "/affordable", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page({ searchParams }: Props) {
  const { max } = await searchParams;
  const maxPrice = asFiniteNumber(max) ?? 100;
  const { sets, total } = await fetchAffordableSets(maxPrice);

  const title = `LEGO Sets Under $${maxPrice}`;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10">
        <div className="text-sm text-zinc-500">
          <Link href="/" className="font-semibold hover:underline">Home</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href="/discover" className="font-semibold hover:underline">Discover</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-zinc-900">{title}</span>
        </div>

        <div className="mt-3">
          <h1 className="m-0 text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {total > 0 ? `${total.toLocaleString()} sets` : "Browse affordable LEGO sets."}
          </p>
        </div>
      </div>

      {sets.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No sets found yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => {
            const imgSrc = safeImageSrc(s.image_url);
            return (
              <div key={s.set_num} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300">
                <div className="flex gap-3">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    {imgSrc ? (
                      <div className="relative h-20 w-24">
                        <Image src={imgSrc} alt={s.name || s.set_num} fill sizes="96px" className="object-contain p-2" />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">No image</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/sets/${encodeURIComponent(s.set_num)}`} className="block truncate text-sm font-semibold hover:underline">
                      {s.name}
                    </Link>
                    <div className="mt-1 text-xs text-zinc-500">
                      <span className="font-semibold">{s.set_num}</span>
                      {typeof s.pieces === "number" && (
                        <><span className="mx-1">&bull;</span><span>{s.pieces.toLocaleString()} pcs</span></>
                      )}
                      {typeof s.year === "number" && (
                        <><span className="mx-1">&bull;</span><span>{s.year}</span></>
                      )}
                    </div>
                    {typeof s.retail_price === "number" && s.retail_price > 0 && (
                      <div className="mt-1 text-sm font-semibold text-zinc-900">${s.retail_price.toFixed(2)}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10">
        <Link href="/discover" className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100">
          &larr; Discover
        </Link>
      </div>
    </div>
  );
}
