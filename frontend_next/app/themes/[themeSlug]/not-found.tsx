// frontend_next/app/themes/[themeSlug]/not-found.tsx
import NotFoundCard from "@/app/components/NotFoundCard";

export default function NotFound() {
  return (
    <NotFoundCard
      title="Theme not found"
      message="That theme doesn’t exist (or the slug changed)."
      hint="Try browsing themes and picking one from the list."
      primary={{ href: "/themes", label: "Browse themes" }}
      secondary={{ href: "/discover", label: "Discover" }}
    />
  );
}