// frontend_next/app/(authed)/layout.tsx
import React from "react";
import AuthedGate from "./AuthedGate";

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <AuthedGate>{children}</AuthedGate>;
}