import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip Next.js internals, static files, and api routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Read auth role from cookies
  const role = request.cookies.get("fc_role")?.value;

  // 3. If unauthenticated and not on /login -> redirect immediately to /login
  if (!role && pathname !== "/login") {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 4. If already authenticated and visiting /login -> redirect to home page
  if (role && pathname === "/login") {
    if (role === "manager") {
      return NextResponse.redirect(new URL("/staff", request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 5. If manager tries to access any non-staff route -> redirect strictly to /staff
  if (role === "manager" && !pathname.startsWith("/staff") && pathname !== "/login") {
    return NextResponse.redirect(new URL("/staff", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
