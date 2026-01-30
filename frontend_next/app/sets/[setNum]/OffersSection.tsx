// frontend_next/app/sets/[setNum]/OffersSection.tsx
import type { StoreOffer } from "@/lib/offers";

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export default function OffersSection({ offers }: { offers: StoreOffer[] }) {
  const sorted = [...offers].sort((a, b) => a.price - b.price);

  return (
    <section id="shop" className="mt-10 scroll-mt-24">
      <h2 className="text-lg font-semibold">Shop &amp; price comparison</h2>

      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No offers yet.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-black/[.08] bg-white shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
          <ul className="divide-y divide-black/[.06] dark:divide-white/[.10]">
            {sorted.map((o) => (
              <li key={`${o.store}-${o.url}`} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="font-semibold">{o.store}</div>
                  <div className="mt-1 text-sm text-zinc-500">{o.in_stock ? "In stock" : "Out of stock"}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-semibold">{formatPrice(o.price, o.currency)}</div>

                  {o.in_stock ? (
                    <a
                      href={o.url}
                      target="_blank"
                      rel="nofollow sponsored noopener noreferrer"
                      className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Buy
                    </a>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="cursor-not-allowed rounded-full bg-zinc-200 px-4 py-2 text-sm font-extrabold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                      Buy
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}