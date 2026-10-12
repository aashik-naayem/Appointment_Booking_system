import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { prisma } from "@bookflow/database";
import { loginSchema } from "@/lib/validations/auth";
import { isGoogleAuthConfigured } from "@/lib/utils/env";
import { authConfig } from "./auth.config";
import { AccountLockedError } from "./errors";
import { verifyCredentials, type CredentialsStore } from "./credentials";
import type { UserRole } from "@bookflow/database";

/** How often (ms) the JWT re-reads role / tenant / deleted state from the database. */
const TOKEN_REFRESH_MS = 5 * 60 * 1000;

const credentialsStore: CredentialsStore = {
  findUserByEmail: (email) =>
    prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        password: true,
        role: true,
        tenantId: true,
        lockedUntil: true,
        failedLoginCount: true,
        deletedAt: true,
      },
    }),
  registerFailure: async (userId, restartCounter) => {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: restartCounter ? 1 : { increment: 1 }, lockedUntil: null },
      select: { failedLoginCount: true },
    });
    return updated.failedLoginCount;
  },
  lockAccount: async (userId, until) => {
    await prisma.user.update({ where: { id: userId }, data: { lockedUntil: until } });
  },
  registerSuccess: async (userId, at) => {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: at },
    });
  },
};

const providers: Provider[] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      let result;
      try {
        result = await verifyCredentials(parsed.data, credentialsStore);
      } catch (error) {
        // Almost always the database (not running, wrong DATABASE_URL, migrations not applied).
        // Log it loudly: Auth.js would otherwise only surface a vague "Configuration" error.
        console.error("[auth] Credentials login failed because of a server/database error:", error);
        throw error;
      }

      if (result.status === "locked") throw new AccountLockedError();
      if (result.status === "invalid") return null;
      return result.user;
    },
  }),
];

// Only register Google when real credentials exist; with the placeholder values from
// .env.example the "Continue with Google" button could only ever end on an error page.
if (isGoogleAuthConfigured()) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env["GOOGLE_CLIENT_ID"]!,
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"]!,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // Initial sign-in: copy fields from the authorized user.
      if (user) {
        token["id"] = user.id;
        token["role"] = user.role;
        token["tenantId"] = user.tenantId ?? null;
        token["refreshedAt"] = Date.now();
        return token;
      }

      if (trigger === "update" && session?.user) {
        token["role"] = session.user.role ?? token["role"];
        token["tenantId"] = session.user.tenantId ?? token["tenantId"];
      }

      // Re-read from the database when the data is stale, or when the user has no tenant yet.
      // The second condition fixes the post-onboarding redirect loop: onboarding creates the
      // tenant in the DB, but the JWT in the cookie still said tenantId = null, so /dashboard
      // kept redirecting back to /onboarding until the 5-minute refresh happened.
      // (The old refresh used the JWT `iat`, which Auth.js resets whenever the cookie is
      // re-issued, so for an active user it effectively never fired.)
      const refreshedAt = token["refreshedAt"] as number | undefined;
      const stale = !refreshedAt || Date.now() - refreshedAt > TOKEN_REFRESH_MS;

      if (token["id"] && (stale || !token["tenantId"])) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token["id"] as string },
            select: { role: true, tenantId: true, deletedAt: true },
          });

          if (!dbUser || dbUser.deletedAt) return null; // account removed -> end the session

          token["role"] = dbUser.role;
          token["tenantId"] = dbUser.tenantId;
          token["refreshedAt"] = Date.now();
        } catch (error) {
          // A temporary DB hiccup must not log everybody out; keep the existing token.
          console.error("[auth] Could not refresh session from the database:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token["id"] as string;
        session.user.role = token["role"] as UserRole;
        session.user.tenantId = (token["tenantId"] as string | null) ?? null;
      }
      return session;
    },
    async signIn({ user, account }) {
      // OAuth: refuse accounts that were soft-deleted.
      if (account?.provider === "google" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { deletedAt: true },
        });
        if (existingUser?.deletedAt) return false;
      }
      return true;
    },
  },
  events: {
    async signIn({ user, account }) {
      // Audit logging must never be able to break a login.
      try {
        if (!user.id) return;
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            tenantId: user.tenantId ?? null,
            action: "LOGIN",
            resource: "User",
            resourceId: user.id,
            description: `User ${user.email} signed in${account?.provider ? ` via ${account.provider}` : ""}`,
          },
        });
        if (account?.provider && account.provider !== "credentials") {
          await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        }
      } catch (error) {
        console.error("[auth] Failed to write login audit log:", error);
      }
    },
    async signOut(message) {
      try {
        const userId =
          "token" in message ? (message.token?.["id"] as string | undefined) : undefined;
        if (!userId) return;
        await prisma.auditLog.create({
          data: {
            userId,
            action: "LOGOUT",
            resource: "User",
            resourceId: userId,
            description: "User signed out",
          },
        });
      } catch (error) {
        console.error("[auth] Failed to write logout audit log:", error);
      }
    },
  },
});
