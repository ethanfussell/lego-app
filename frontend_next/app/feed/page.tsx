// frontend_next/app/feed/page.tsx
import type { Metadata } from "next";
import SocialFeedClient from "./SocialFeedClient";

export const metadata: Metadata = {
  title: "Feed",
  description: "See posts from people you follow on BrickTrack.",
};

export default function FeedPage() {
  return <SocialFeedClient />;
}
