// frontend_next/app/account/lists/page.tsx
import type { Metadata } from "next";
import ListsClient from "./ListsClient";

export const metadata: Metadata = {
  title: "My lists",
};

export default function Page() {
  return <ListsClient />;
}