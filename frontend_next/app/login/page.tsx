// frontend_next/app/login/page.tsx
import { Suspense } from "react";
import LoginPage from "./LoginPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading…</div>}>
      <LoginPage />
    </Suspense>
  );
}