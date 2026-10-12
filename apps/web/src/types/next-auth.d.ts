import type { UserRole } from "@bookflow/database";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      role: UserRole;
      tenantId: string | null;
    };
  }

  interface User {
    role?: UserRole;
    tenantId?: string | null;
    /** ms timestamp of the last time role/tenant were re-read from the database */
    refreshedAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    tenantId?: string | null;
    /** ms timestamp of the last time role/tenant were re-read from the database */
    refreshedAt?: number;
  }
}
