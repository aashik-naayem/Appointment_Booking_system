import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";

// Use the edge-safe config only (no Prisma / bcrypt) so this runs on the Edge runtime.
const { auth } = NextAuth(authConfig);

const PROTECTED_PATHS = [
  "/dashboard",
  "/appointments",
  "/calendar",
  "/customers",
  "/staff",
  "/services",
  "/analytics",
  "/billing",
  "/settings",
  "/onboarding",
];
const ADMIN_PATHS = ["/admin"];
const AUTH_PATHS = ["/auth/login", "/auth/register"];

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const path = nextUrl.pathname;

  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p));
  const isAdmin = ADMIN_PATHS.some((p) => path.startsWith(p));
  const isAuthPage = AUTH_PATHS.some((p) => path.startsWith(p));

  // Redirect unauthenticated users to login
  if ((isProtected || isAdmin) && !session?.user) {
    const loginUrl = new URL("/auth/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes require SUPER_ADMIN
  if (isAdmin && session?.user && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  // Keep signed-in users away from the login/register pages
  if (isAuthPage && session?.user) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|book|booking).*)"],
};
