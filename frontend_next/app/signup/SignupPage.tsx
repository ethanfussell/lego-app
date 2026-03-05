"use client";

import { RedirectToSignUp } from "@clerk/nextjs";

/**
 * Legacy /signup route — redirect to Clerk's sign-up page.
 * Keeps old bookmarks and links working.
 */
export default function SignupPage() {
  return <RedirectToSignUp />;
}
