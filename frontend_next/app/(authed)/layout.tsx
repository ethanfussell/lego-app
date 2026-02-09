// frontend_next/app/(authed)/layout.tsx
import React from "react";
import type { Metadata } from "next";
import AuthedGate from "./AuthedGate";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <AuthedGate>{children}</AuthedGate>;
}