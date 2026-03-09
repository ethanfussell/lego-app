// frontend_next/app/themes/ThemesClient.tsx
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";
import { useCollectionStatus } from "@/lib/useCollectionStatus";

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  image_url?: string | null;
  rating_count?: number | null;
  rating_avg?: number | null;
};

type SetCardSetProp = React.ComponentProps<typeof SetCard>["set"];

function toSetCardSet(s: SetSummary): SetCardSetProp {
  return {
    set_num: s.set_num,
    name: s.name,
    year: s.year,
    pieces: typeof s.pieces === "number" ? s.pieces : null,
    image_url: typeof s.image_url === "string" ? s.image_url : null,
    rating_count: typeof s.rating_count === "number" ? s.rating_count : null,
    rating_avg: typeof s.rating_avg === "number" ? s.rating_avg : null,
  } as unknown as SetCardSetProp;
}

export default function ThemesClient({ sets }: { sets: SetSummary[] }) {
  const { token } = useAuth();
  const { isOwned, isWishlist, getUserRating } = useCollectionStatus();
  const cardSets = useMemo(() => sets.map(toSetCardSet), [sets]);

  return (
    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cardSets.map((setForCard, idx) => {
        const original = sets[idx];

        return (
          <div key={original.set_num} className="h-full">
            <SetCard
              set={setForCard}
              token={token ?? undefined}
              isOwnedByUser={isOwned(original.set_num)}
              userRatingOverride={getUserRating(original.set_num)}
              footer={
                <div className="space-y-2">
                  <SetCardActions token={token ?? null} setNum={original.set_num} isOwned={isOwned(original.set_num)} isWishlist={isWishlist(original.set_num)} />
                  <Link
                    href={`/sets/${encodeURIComponent(original.set_num)}`}
                    className="block text-center text-sm font-semibold text-zinc-900 hover:text-amber-600 hover:underline"
                  >
                    View set →
                  </Link>
                </div>
              }
            />
          </div>
        );
      })}
    </div>
  );
}