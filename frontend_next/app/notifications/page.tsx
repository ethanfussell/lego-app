// frontend_next/app/notifications/page.tsx
// Social features are disabled for now — redirect to home
import { redirect } from "next/navigation";

export default function NotificationsPage() {
  redirect("/");
}
