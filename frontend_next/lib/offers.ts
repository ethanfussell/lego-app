import { apiFetch } from "@/lib/api";

export type StoreOffer = {
  store: string;
  price: number;
  currency: string;
  url: string;
  in_stock: boolean;
};

export async function fetchOffersForSet(plainSetNum: string): Promise<StoreOffer[]> {
  try {
    const data = await apiFetch<StoreOffer[]>(`/offers/${encodeURIComponent(plainSetNum)}`, {
      cache: "no-store",
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}