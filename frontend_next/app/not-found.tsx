import type { Metadata } from "next";
import NotFoundCard from "@/app/components/NotFoundCard";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <NotFoundCard
      title="Page not found"
      message="That page doesn’t exist (or the link is outdated)."
      primary={{ href: "/search", label: "Search sets" }}
      secondary={{ href: "/", label: "Go home" }}
    />
  );
}