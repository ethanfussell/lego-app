"use client";

import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useAuth } from "@/app/providers";

type Props = {
  sets: any[];
};

export default function SaleClient({ sets }: Props) {
  const { token, hydrated } = useAuth();

  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fill,220px)] justify-start gap-3">
      {sets.map((set) => (
        <div key={set.set_num} className="w-[220px]">
          <SetCard
            set={set}
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