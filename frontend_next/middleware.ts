import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

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

/**
 * Site-wide password gate — runs BEFORE Clerk so password-related
 * routes never wait on Clerk's external auth checks.
 */
function passwordGate(req: NextRequest): NextResponse | null {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) return null; // gate disabled

  const { pathname } = req.nextUrl;
  const isPasswordPage = pathname === "/password";
  const isPasswordApi = pathname === "/api/password";

  // Let the password page and API through without any middleware processing
  if (isPasswordPage || isPasswordApi) return NextResponse.next();

  const hasAccess = req.cookies.get("site_access")?.value === "granted";
  if (!hasAccess) {
    return NextResponse.redirect(new URL("/password", req.url));
  }

  return null; // has access, continue to Clerk
}

const clerk = clerkMiddleware(async (auth, req) => {
  // Protect non-public routes — user must be signed in
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export default function middleware(req: NextRequest) {
  const gateResponse = passwordGate(req);
  if (gateResponse) return gateResponse;

  return clerk(req, {} as never);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
