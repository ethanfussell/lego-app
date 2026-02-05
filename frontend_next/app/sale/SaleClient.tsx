// frontend_next/app/sale/SaleClient.tsx
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

type Props = {
  sets: SetLite[];
};

export default function SaleClient({ sets }: Props) {
  const { token, hydrated } = useAuth();

  // Avoid `as any` for SetCard props
  type SetCardSetProp = React.ComponentProps<typeof SetCard>["set"];

  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
      {sets.map((set) => (
        <div key={set.set_num} className="w-[220px]">
          <SetCard
            set={set as unknown as SetCardSetProp}
            footer={
              hydrated && token ? (
                <SetCardActions token={token} setNum={set.set_num} />
              ) : (
                <div className="text-xs text-zinc-500">Log in to add to lists</div>
              )
            }
          />
        </div>
      ))}
    </div>
  );
}