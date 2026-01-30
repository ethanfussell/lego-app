"use client";

import React from "react";
import Link from "next/link";
import AddToListMenu from "@/app/components/AddToListMenu";

export default function SetCardActions({ token, setNum }: { token: string; setNum: string }) {
  const sn = encodeURIComponent(String(setNum || "").trim());

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/sets/${sn}?focus=shop`}
        scroll={true} // ensures we start at top on navigation
        className="whitespace-nowrap rounded-full border border-black/[.10] bg-white px-4 py-2 text-center text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
      >
        Shop
      </Link>

      <AddToListMenu token={token} setNum={setNum} fullWidth />
    </div>
  );
}