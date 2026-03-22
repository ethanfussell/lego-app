// frontend_next/app/coming-soon/ComingSoonClient.tsx
"use client";

import React from "react";

export default function ComingSoonClient({
  initialSets: _initialSets,
  initialError: _initialError,
}: {
  initialSets: unknown[];
  initialError: string | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pb-16 pt-20 text-center">
      <div className="mb-6 text-5xl">🧱</div>
      <h1 className="text-3xl font-bold text-zinc-800">Coming Soon</h1>
      <p className="mt-4 max-w-md text-lg text-zinc-500">
        We&apos;re working on bringing you upcoming LEGO set releases. Check back soon!
      </p>
    </div>
  );
}
