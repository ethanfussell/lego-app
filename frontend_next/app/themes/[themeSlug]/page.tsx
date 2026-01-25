// frontend_next/app/themes/[themeSlug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

const SITE_NAME = "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

type SetLite = {
  set_num: string;
  name?: string;
  theme?: string;
  num_parts?: number;
  year?: number;
  image_url?: string | null;
};

type SP = Record<string, string | string[] | undefined>;

async function unwrapParams<T extends object>(p: T | Promise<T>): Promise<T> {
  return typeof (p as any)?.then === "function" ? await (p as any) : (p as T);
}

function first(sp: SP, key: string): string {
  const raw = sp[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v || "").toString().trim();
}

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
  searchParams?: SP | Promise<SP>;
}): Promise<Metadata> {
  const { themeSlug } = await unwrapParams(params);
  const sp = await unwrapParams(searchParams || ({} as SP));

  const theme = decodeURIComponent(themeSlug);
  const page = toInt(first(sp, "page") || "1", 1);

  const canonical =
    `/themes/${encodeURIComponent(theme)}` + (page > 1 ? `?page=${page}` : "");

  const title = `${theme} sets | ${SITE_NAME}`;
  const description =
    page > 1
      ? `Browse LEGO sets in the ${theme} theme. Page ${page}.`
      : `Browse LEGO sets in the ${theme} theme.`;

  return {
    title,
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ThemeSetsPage({
  params,
  searchParams,
}: {
  params: { themeSlug: string } | Promise<{ themeSlug: string }>;
  searchParams?: SP | Promise<SP>;
}) {
  const { themeSlug } = await unwrapParams(params);
  const sp = await unwrapParams(searchParams || ({} as SP));

  const theme = decodeURIComponent(themeSlug);

  const page = toInt(first(sp, "page") || "1", 1);
  const limit = Math.min(toInt(first(sp, "limit") || "36", 36), 100);
  const sort = first(sp, "sort") || "relevance";
  const order = first(sp, "order") || "";

  const qs = buildQuery({
    page,
    limit,
    sort,
    order: order || undefined,
  });

  const path = `/themes/${encodeURIComponent(theme)}/sets${qs}`;

  let sets: SetLite[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<any>(path, { cache: "no-store" });
    if (Array.isArray(data)) sets = data as SetLite[];
    else if (data && Array.isArray(data.results)) sets = data.results as SetLite[];
  } catch (e: any) {
    error = e?.message || String(e);
  }

  const prevHref =
    page > 1
      ? `/themes/${encodeURIComponent(theme)}${buildQuery({
          page: page - 1,
          limit,
          sort,
          order: order || undefined,
        })}`
      : null;

  const nextHref = `/themes/${encodeURIComponent(theme)}${buildQuery({
    page: page + 1,
    limit,
    sort,
    order: order || undefined,
  })}`;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/themes" className="hover:underline">
            Themes
          </Link>{" "}
          / <span className="font-semibold text-zinc-800 dark:text-zinc-200">{theme}</span>
        </div>

        <h1 className="mt-2 text-3xl font-bold">{theme}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Page {page} • {sets.length} set{sets.length === 1 ? "" : "s"} loaded
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
          Error loading sets: {error}
        </div>
      ) : sets.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">No sets found.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => (
            <li
              key={s.set_num}
              className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-black"
            >
              <Link href={`/sets/${encodeURIComponent(s.set_num)}`} className="hover:underline">
                <div className="font-semibold">{s.name || s.set_num}</div>
              </Link>

              <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                <div>{s.set_num}</div>
                {typeof s.year === "number" ? <div>Year: {s.year}</div> : null}
                {typeof s.num_parts === "number" ? <div>Parts: {s.num_parts}</div> : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex items-center justify-between">
        {prevHref ? (
          <Link
            href={prevHref}
            className="rounded-full border border-black/[.12] px-4 py-2 hover:bg-zinc-50 dark:border-white/[.2] dark:hover:bg-zinc-900"
          >
            ← Prev
          </Link>
        ) : (
          <div />
        )}

        <Link
          href={nextHref}
          className="rounded-full border border-black/[.12] px-4 py-2 hover:bg-zinc-50 dark:border-white/[.2] dark:hover:bg-zinc-900"
        >
          Next →
        </Link>
      </div>
    </div>
  );
}