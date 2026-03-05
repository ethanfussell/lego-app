// frontend_next/app/years/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { siteBase, SITE_NAME } from "@/lib/url";
import { first, type SP } from "@/lib/searchParams";

type JsonLdObject = Record<string, unknown>;

function buildBreadcrumbJsonLd(items: Array<{ label: string; href: string }>, baseUrl: string): JsonLdObject {
  const normBase = String(baseUrl || "").replace(/\/+$/, "") || "http://localhost:3000";
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: it.label,
      item: new URL(it.href, normBase).toString(),
    })),
  };
}

function yearBounds() {
  return { min: 1980, max: new Date().getFullYear() };
}

function toInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}): Promise<Metadata> {
  const sp = (await searchParams) ?? ({} as SP);
  const page = toInt(first(sp, "page") || "1", 1);

  const title = "Browse by year";
  const description = `Browse LEGO sets by release year on ${SITE_NAME}.`;
  const canonicalPath = "/years";

  // Paginated pages should be noindex to avoid duplicate indexable content.
  const robots = page > 1 ? ({ index: false, follow: true } as const) : undefined;

  return {
    title, // ✅ layout template will append " | LEGO App"
    description,
    metadataBase: new URL(siteBase()),
    alternates: { canonical: canonicalPath },
    robots,
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

export default function YearsPage() {
  const { min, max } = yearBounds();

  const breadcrumbLd = buildBreadcrumbJsonLd(
    [
      { label: "Home", href: "/" },
      { label: "Years", href: "/years" },
    ],
    siteBase()
  );

  const years: number[] = [];
  for (let y = max; y >= min; y--) years.push(y);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Years" }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Browse by year</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Pick a year from {min} to {max}.
          </p>

          <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/themes" className="text-zinc-900 hover:underline dark:text-zinc-50">
              Browse themes →
            </Link>
            <Link href={`/years/${max}`} className="text-zinc-900 hover:underline dark:text-zinc-50">
              Newest year →
            </Link>
          </div>
        </div>

        <Link href="/" className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
          ← Home
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {years.map((y) => (
          <Link
            key={y}
            href={`/years/${y}`}
            className="grid h-11 place-items-center rounded-xl border border-black/[.08] bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/[.14] dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            {y}
          </Link>
        ))}
      </div>
    </div>
  );
}