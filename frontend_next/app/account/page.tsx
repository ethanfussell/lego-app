// frontend_next/app/account/page.tsx
import AccountClient from "./AccountClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account | LEGO App",
};

export default function Page() {
  return <AccountClient />;
}