// frontend_next/app/themes/ThemesClient.tsx
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  pieces?: number;
  image_url?: string | null;
  rating_count?: number | null;
  rating_avg?: number | null;
  average_rating?: number | null;
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
    average_rating: typeof s.average_rating === "number" ? s.average_rating : null,
  } as unknown as SetCardSetProp;
}

export default function ThemesClient({ sets }: { sets: SetSummary[] }) {
  const { token } = useAuth();
  const cardSets = useMemo(() => sets.map(toSetCardSet), [sets]);

  return (
    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cardSets.map((setForCard, idx) => {
        const original = sets[idx];

        return (
          <div key={original.set_num} className="h-full">
            <SetCard
              set={setForCard}
              footer={
                <div className="space-y-2">
                  <SetCardActions token={token ?? null} setNum={original.set_num} />
                  <Link
                    href={`/sets/${encodeURIComponent(original.set_num)}`}
                    className="block text-center text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
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