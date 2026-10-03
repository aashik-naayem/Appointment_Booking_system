import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/appointments", "/calendar", "/customers", "/staff", "/services", "/analytics", "/billing", "/settings", "/onboarding"];
const ADMIN_PATHS = ["/admin"];
const AUTH_PATHS = ["/auth/login", "/auth/register"];

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const path = nextUrl.pathname;

  // Check if it's a protected route
  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p));
  const isAdmin = ADMIN_PATHS.some((p) => path.startsWith(p));
  const isAuth = AUTH_PATHS.some((p) => path.startsWith(p));

  // Redirect unauthenticated users
  if ((isProtected || isAdmin) && !session?.user) {
    const loginUrl = new URL("/auth/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect super_admin check for admin routes
  if (isAdmin && session?.user && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  // Redirect authenticated users away from auth pages
  if (isAuth && session?.user) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|book|booking).*)",
  ],
};
