import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
