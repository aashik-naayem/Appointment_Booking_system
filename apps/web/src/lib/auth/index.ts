import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@bookflow/database";
import { loginSchema } from "@/lib/validations/auth";
import type { UserRole } from "@bookflow/database";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
    newUser: "/onboarding",
  },
  providers: [
    GoogleProvider({
      clientId: process.env["GOOGLE_CLIENT_ID"]!,
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"]!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            password: true,
            role: true,
            tenantId: true,
            emailVerified: true,
            lockedUntil: true,
            failedLoginCount: true,
          },
        });

        if (!user || !user.password) return null;

        // Check account lock
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("AccountLocked");
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
          // Increment failed login count
          const failedCount = user.failedLoginCount + 1;
          const lockUntil = failedCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: failedCount,
              lockedUntil: lockUntil,
            },
          });
          return null;
        }

        // Reset failed login count
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token["id"] = user.id;
        token["role"] = user.role;
        token["tenantId"] = user.tenantId;
      }

      // Handle session updates
      if (trigger === "update" && session) {
        token["role"] = session.user?.role ?? token["role"];
        token["tenantId"] = session.user?.tenantId ?? token["tenantId"];
      }

      // Refresh from DB occasionally (every 5 minutes)
      const tokenIat = token["iat"] as number | undefined;
      if (tokenIat && Date.now() / 1000 - tokenIat > 300) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token["id"] as string },
          select: { role: true, tenantId: true, deletedAt: true },
        });

        if (!dbUser || dbUser.deletedAt) return null;

        token["role"] = dbUser.role;
        token["tenantId"] = dbUser.tenantId;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token["id"] as string;
        session.user.role = token["role"] as UserRole;
        session.user.tenantId = token["tenantId"] as string | null;
      }
      return session;
    },
    async signIn({ user, account }) {
      // For OAuth signins, link to existing account if email matches
      if (account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (existingUser?.deletedAt) {
          return false; // Deleted user
        }
      }

      return true;
    },
  },
  events: {
    async signIn({ user }) {
      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          resource: "User",
          resourceId: user.id,
          description: `User ${user.email} signed in`,
        },
      });
    },
  },
});
