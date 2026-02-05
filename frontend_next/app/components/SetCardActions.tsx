// frontend_next/app/components/SetCardActions.tsx
"use client";

import Link from "next/link";
import AddToListMenu from "@/app/components/AddToListMenu";
import { trackLoginCta, trackShopClick } from "@/lib/analytics";
import { outboundClick } from "@/lib/ga";

export default function SetCardActions({
  token,
  setNum,
  className = "",
}: {
  token?: string | null;
  setNum: string;
  className?: string;
}) {
  const shopHref = `/sets/${encodeURIComponent(setNum)}#shop`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Shop */}
      <div className="flex-1">
        <Link
          href={shopHref}
          onClick={() => {
            trackShopClick({ set_num: setNum, placement: "set_card_actions" });

            // GA event (counts as outbound-intent; actual outbound happens on the shop section)
            outboundClick({
              url: shopHref,
              label: "Shop",
              placement: "set_card_actions",
              set_num: setNum,
            });
          }}
          className={[
            "inline-flex w-full items-center justify-center",
            "whitespace-nowrap rounded-full border border-black/[.10] bg-white",
            "px-4 py-2 text-sm font-semibold hover:bg-black/[.04]",
            "dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]",
          ].join(" ")}
        >
          Shop
        </Link>
      </div>

      {/* Add to list (or prompt to login) */}
      <div className="flex-1">
        {token ? (
          <AddToListMenu
            token={token}
            setNum={setNum}
            fullWidth
            buttonClassName={["w-full justify-center", "px-4 py-2 text-sm font-semibold"].join(" ")}
          />
        ) : (
          <Link
            href="/login"
            onClick={() => {
              trackLoginCta({ placement: "set_card_actions" });

              outboundClick({
                url: "/login",
                label: "Log in",
                placement: "set_card_actions",
                set_num: setNum,
              });
            }}
            className={[
              "inline-flex w-full items-center justify-center",
              "whitespace-nowrap rounded-full border border-black/[.10] bg-white",
              "px-4 py-2 text-sm font-semibold hover:bg-black/[.04]",
              "dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]",
            ].join(" ")}
          >
            Log in
          </Link>
        )}
      </div>
    </div>
  );
}