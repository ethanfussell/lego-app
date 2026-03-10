import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Public routes — accessible without authentication.
 * Everything else is also accessible (Clerk middleware doesn't block by default),
 * but the route matchers below let us protect specific routes.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/search(.*)",
  "/sets/(.*)",
  "/themes(.*)",
  "/retiring-soon(.*)",
  "/new(.*)",
  "/sale(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/login(.*)",
  "/signup(.*)",
  "/lists/(.*)", // public list viewing
  "/api/(.*)", // API proxy routes
]);

export default clerkMiddleware(async (auth, req) => {
  // Site-wide password gate (temporary, for pre-launch)
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    const { pathname } = req.nextUrl;
    const isPasswordPage = pathname === "/password";
    const isPasswordApi = pathname === "/api/password";
    const hasAccess = req.cookies.get("site_access")?.value === "granted";

    if (!hasAccess && !isPasswordPage && !isPasswordApi) {
      return NextResponse.redirect(new URL("/password", req.url));
    }
  }

  // Protect non-public routes — user must be signed in
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
