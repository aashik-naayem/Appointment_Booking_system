/**
 * Framework-independent credential verification (no next-auth / Prisma imports),
 * so the lockout rules can be unit-tested with an in-memory store.
 */
import bcrypt from "bcryptjs";
import type { UserRole } from "@bookflow/database";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export type CredentialUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  password: string | null;
  role: UserRole;
  tenantId: string | null;
  lockedUntil: Date | null;
  failedLoginCount: number;
  deletedAt: Date | null;
};

export interface CredentialsStore {
  findUserByEmail(email: string): Promise<CredentialUser | null>;
  /** Atomically bump the failure counter (or restart it at 1) and return the new value. */
  registerFailure(userId: string, restartCounter: boolean): Promise<number>;
  lockAccount(userId: string, until: Date): Promise<void>;
  registerSuccess(userId: string, at: Date): Promise<void>;
}

export type CredentialsResult =
  | {
      status: "ok";
      user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
        role: UserRole;
        tenantId: string | null;
      };
    }
  | { status: "invalid" }
  | { status: "locked"; until: Date };

let dummyHash: string | undefined;
/** Compared against when the email is unknown so response time does not reveal which emails exist. */
function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync("bookflow-timing-guard", 12);
  return dummyHash;
}

export async function verifyCredentials(
  input: { email: string; password: string },
  store: CredentialsStore,
  now: Date = new Date(),
): Promise<CredentialsResult> {
  const user = await store.findUserByEmail(input.email);

  // Unknown email, OAuth-only account (no password) or soft-deleted account.
  if (!user || !user.password || user.deletedAt) {
    await bcrypt.compare(input.password, getDummyHash());
    return { status: "invalid" };
  }

  if (user.lockedUntil && user.lockedUntil > now) {
    return { status: "locked", until: user.lockedUntil };
  }

  const valid = await bcrypt.compare(input.password, user.password);

  if (!valid) {
    // If a previous lock has expired, start counting from scratch. Without this a
    // single typo after the lock expired re-locked the account immediately,
    // because failedLoginCount was still >= 5.
    const lockExpired = user.lockedUntil !== null && user.lockedUntil <= now;
    const failures = await store.registerFailure(user.id, lockExpired);
    if (failures >= MAX_FAILED_LOGINS) {
      await store.lockAccount(user.id, new Date(now.getTime() + LOCK_DURATION_MS));
    }
    return { status: "invalid" };
  }

  await store.registerSuccess(user.id, now);

  return {
    status: "ok",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      tenantId: user.tenantId,
    },
  };
}
