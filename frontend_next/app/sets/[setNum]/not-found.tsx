import type { Metadata } from "next";
import NotFoundCard from "@/app/components/NotFoundCard";

export const metadata: Metadata = { title: "Set not found" };

export default function NotFound() {
  return (
    <NotFoundCard
      title="Set not found"
      message="We couldn’t find that set number."
      hint="Tip: set numbers look like 75304-1."
      primary={{ href: "/search", label: "Search sets" }}
      secondary={{ href: "/discover", label: "Browse discover" }}
    />
  );
}