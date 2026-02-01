import type { Metadata } from "next";
import NotFoundCard from "@/app/components/NotFoundCard";

export const metadata: Metadata = { title: "List not found" };

export default function NotFound() {
  return (
    <NotFoundCard
      title="List not found"
      message="That list doesn’t exist, or it’s private."
      hint="If it’s a private list, try logging in and opening it again."
      primary={{ href: "/collection", label: "My collection" }}
      secondary={{ href: "/discover/lists", label: "Browse public lists" }}
    />
  );
}