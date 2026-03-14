// frontend_next/app/feed/page.tsx
// Social features are disabled for now — redirect to home
import { redirect } from "next/navigation";

export default function FeedPage() {
  redirect("/");
}
