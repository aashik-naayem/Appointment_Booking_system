/**
 * Edge-safe Auth.js config.
 *
 * This file must NOT import Prisma, bcrypt or anything that needs Node APIs,
 * because it is used by `middleware.ts`, which runs on the Edge runtime.
 * The full config (adapter, providers, DB callbacks) lives in ./index.ts.
 */
import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@bookflow/database";

export const authConfig = {
  // Required when running behind a proxy / on a custom host; harmless on localhost.
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
    newUser: "/onboarding",
  },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token["id"] as string;
        session.user.role = token["role"] as UserRole;
        session.user.tenantId = (token["tenantId"] as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
