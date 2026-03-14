// frontend_next/app/notifications/page.tsx
import type { Metadata } from "next";
import NotificationsClient from "./NotificationsClient";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Your notifications on BrickTrack.",
};

export default function NotificationsPage() {
  return <NotificationsClient />;
}
