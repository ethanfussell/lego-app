// frontend_next/lib/format.ts

/**
 * Format a numeric price for display.
 * Uses Intl.NumberFormat when a valid 3-letter currency code is provided.
 * Returns null for non-numeric / non-finite input.
 */
export function formatPrice(price?: number | null, currency?: string): string | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;

  if (currency && currency.length === 3) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        currencyDisplay: "symbol",
        maximumFractionDigits: 2,
      }).format(price);
    } catch {
      // fall through
    }
  }

  const rounded = Number(price.toFixed(2));
  return currency ? `${currency} ${rounded}` : `$${rounded}`;
}
