import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import {
  verifyCredentials,
  MAX_FAILED_LOGINS,
  LOCK_DURATION_MS,
  type CredentialUser,
  type CredentialsStore,
} from "@/lib/auth/credentials";

const PASSWORD = "Demo1234";
let hash: string;

beforeAll(() => {
  hash = bcrypt.hashSync(PASSWORD, 4); // low cost: tests only
});

function makeStore(initial: Partial<CredentialUser> | null) {
  const user: CredentialUser | null = initial
    ? {
        id: "u1",
        email: "demo@bookflow.app",
        name: "Demo",
        image: null,
        password: hash,
        role: "OWNER",
        tenantId: "t1",
        lockedUntil: null,
        failedLoginCount: 0,
        deletedAt: null,
        ...initial,
      }
    : null;

  const store: CredentialsStore & { user: CredentialUser | null; successes: number } = {
    user,
    successes: 0,
    async findUserByEmail() {
      return this.user ? { ...this.user } : null;
    },
    async registerFailure(_id, restart) {
      this.user!.failedLoginCount = restart ? 1 : this.user!.failedLoginCount + 1;
      this.user!.lockedUntil = null;
      return this.user!.failedLoginCount;
    },
    async lockAccount(_id, until) {
      this.user!.lockedUntil = until;
    },
    async registerSuccess() {
      this.successes++;
      this.user!.failedLoginCount = 0;
      this.user!.lockedUntil = null;
    },
  };
  return store;
}

const input = (password: string) => ({ email: "demo@bookflow.app", password });

describe("verifyCredentials", () => {
  it("accepts the right password and resets the failure counter", async () => {
    const store = makeStore({ failedLoginCount: 3 });
    const res = await verifyCredentials(input(PASSWORD), store);
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.user).toMatchObject({ id: "u1", role: "OWNER", tenantId: "t1" });
      expect(res.user).not.toHaveProperty("password");
    }
    expect(store.user!.failedLoginCount).toBe(0);
    expect(store.successes).toBe(1);
  });

  it("rejects a wrong password and counts the failure", async () => {
    const store = makeStore({});
    const res = await verifyCredentials(input("wrong"), store);
    expect(res.status).toBe("invalid");
    expect(store.user!.failedLoginCount).toBe(1);
    expect(store.user!.lockedUntil).toBeNull();
  });

  it("locks the account on the 5th consecutive failure", async () => {
    const store = makeStore({ failedLoginCount: MAX_FAILED_LOGINS - 1 });
    const now = new Date("2026-10-11T10:00:00Z");
    await verifyCredentials(input("wrong"), store, now);
    expect(store.user!.lockedUntil?.getTime()).toBe(now.getTime() + LOCK_DURATION_MS);
  });

  it("refuses even the correct password while locked", async () => {
    const now = new Date("2026-10-11T10:00:00Z");
    const store = makeStore({ failedLoginCount: 5, lockedUntil: new Date(now.getTime() + 60_000) });
    const res = await verifyCredentials(input(PASSWORD), store, now);
    expect(res.status).toBe("locked");
    expect(store.successes).toBe(0);
  });

  it("lets the user in once the lock has expired", async () => {
    const now = new Date("2026-10-11T10:00:00Z");
    const store = makeStore({ failedLoginCount: 5, lockedUntil: new Date(now.getTime() - 1000) });
    const res = await verifyCredentials(input(PASSWORD), store, now);
    expect(res.status).toBe("ok");
  });

  it("does not re-lock immediately after an expired lock (counter restarts at 1)", async () => {
    const now = new Date("2026-10-11T10:00:00Z");
    const store = makeStore({ failedLoginCount: 5, lockedUntil: new Date(now.getTime() - 1000) });
    const res = await verifyCredentials(input("typo"), store, now);
    expect(res.status).toBe("invalid");
    expect(store.user!.failedLoginCount).toBe(1);
    expect(store.user!.lockedUntil).toBeNull();
  });

  it("rejects unknown emails", async () => {
    const res = await verifyCredentials(input(PASSWORD), makeStore(null));
    expect(res.status).toBe("invalid");
  });

  it("rejects OAuth-only accounts that have no password", async () => {
    const res = await verifyCredentials(input(PASSWORD), makeStore({ password: null }));
    expect(res.status).toBe("invalid");
  });

  it("rejects soft-deleted accounts even with the right password", async () => {
    const store = makeStore({ deletedAt: new Date() });
    const res = await verifyCredentials(input(PASSWORD), store);
    expect(res.status).toBe("invalid");
    expect(store.successes).toBe(0);
  });
});
