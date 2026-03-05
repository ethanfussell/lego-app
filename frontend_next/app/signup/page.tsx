import { Suspense } from "react";
import SignupPage from "./SignupPage";

export const metadata = {
  title: "Create Account",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading…</div>}>
      <SignupPage />
    </Suspense>
  );
}
