"use client";

import { RedirectToSignIn } from "@clerk/nextjs";

/**
 * Legacy /login route — redirect to Clerk's sign-in page.
 * Keeps old bookmarks and links working.
 */
export default function LoginPage() {
  return <RedirectToSignIn />;
}
