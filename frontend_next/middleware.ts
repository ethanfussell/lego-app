import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

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
  "/password", // site-wide password gate
  "/api/(.*)", // API proxy routes
]);

const clerk = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Site-wide password gate — handled before Clerk to avoid external auth calls
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    const { pathname } = req.nextUrl;

    // Password page & API bypass everything
    if (pathname === "/password" || pathname === "/api/password") {
      return NextResponse.next();
    }

    // No access cookie → redirect to password page
    if (req.cookies.get("site_access")?.value !== "granted") {
      return NextResponse.redirect(new URL("/password", req.url));
    }
  }

  // Authenticated user or gate disabled — run Clerk
  return clerk(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
