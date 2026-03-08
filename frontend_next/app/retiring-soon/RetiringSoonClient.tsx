// frontend_next/app/retiring-soon/RetiringSoonClient.tsx
"use client";

import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import { formatPrice } from "@/lib/format";
import type { SetLite } from "@/lib/types";

function formatExitDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return raw;
  }
}

function RetireInfo({ set }: { set: SetLite }) {
  const price = typeof set.retail_price === "number" ? set.retail_price : null;
  const exitDate = formatExitDate(set.exit_date ?? set.retirement_date ?? null);

  if (!price && !exitDate) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {price ? (
        <span className="font-semibold text-zinc-900">{formatPrice(price)}</span>
      ) : null}
      {exitDate ? (
        <span className="text-zinc-500">Retires {exitDate}</span>
      ) : null}
    </div>
  );
}

export default function RetiringSoonClient({
  initialSets,
  initialError,
}: {
  initialSets: SetLite[];
  initialError: string | null;
}) {
  const { token } = useAuth();
  const { isOwned, isWishlist } = useCollectionStatus();
  const sets = Array.isArray(initialSets) ? initialSets : [];

  type SetCardSetProp = React.ComponentProps<typeof SetCard>["set"];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">Retiring soon</h1>
        <p className="mt-2 max-w-[540px] text-sm text-zinc-500">
          These sets are expected to retire soon. Grab them before they are gone.
        </p>

        {initialError ? <p className="mt-4 text-sm text-red-600">Error: {initialError}</p> : null}

        {!initialError && sets.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No sets marked as retiring soon right now.</p>
        ) : null}

        {!initialError && sets.length > 0 ? (
          <>
            <p className="mt-3 text-xs text-zinc-400">
              {sets.length} set{sets.length === 1 ? "" : "s"} retiring soon
            </p>

            <ul className="mt-4 grid list-none gap-3 p-0 justify-start items-stretch [grid-template-columns:repeat(auto-fill,220px)]">
              {sets.map((set) => (
                <li key={set.set_num} className="h-full">
                  <SetCard
                    set={set as unknown as SetCardSetProp}
                    footer={
                      <div className="space-y-2">
                        <RetireInfo set={set} />
                        <SetCardActions token={token ?? null} setNum={set.set_num} isOwned={isOwned(set.set_num)} isWishlist={isWishlist(set.set_num)} />
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
