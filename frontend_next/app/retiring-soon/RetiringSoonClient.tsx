// frontend_next/app/retiring-soon/RetiringSoonClient.tsx
"use client";

import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  theme?: string;
  image_url?: string | null;
  average_rating?: number | null;
  rating_avg?: number | null;
  rating_count?: number;
};

export default function RetiringSoonClient({
  initialSets,
  initialError,
}: {
  initialSets: SetLite[];
  initialError: string | null;
}) {
  const { token } = useAuth();
  const sets = Array.isArray(initialSets) ? initialSets : [];

  // Avoid `as any` for SetCard props
  type SetCardSetProp = React.ComponentProps<typeof SetCard>["set"];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="mt-10">
        <h1 className="m-0 text-2xl font-semibold">Retiring soon</h1>
        <p className="mt-2 max-w-[540px] text-sm text-zinc-500">
          Last-chance sets. Later this page will show sets that are officially marked as retiring soon so you can grab
          them before they disappear.
        </p>

        {initialError ? <p className="mt-4 text-sm text-red-600">Error: {initialError}</p> : null}

        {!initialError && sets.length === 0 ? <p className="mt-4 text-sm text-zinc-500">No “retiring soon” sets yet.</p> : null}

        {!initialError && sets.length > 0 ? (
          <ul className="mt-6 grid list-none gap-3 p-0 justify-start items-stretch [grid-template-columns:repeat(auto-fill,220px)]">
            {sets.map((set) => (
              <li key={set.set_num} className="h-full">
                <SetCard
                  set={set as unknown as SetCardSetProp}
                  footer={<SetCardActions token={token ?? null} setNum={set.set_num} />}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}