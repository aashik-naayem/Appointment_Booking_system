import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  redirect: vi.fn(),
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
}));

// Mock Prisma — tests use a real test DB or mocked queries
vi.mock("@bookflow/database", async () => {
  const actual = await vi.importActual<typeof import("@bookflow/database")>("@bookflow/database");
  return {
    ...actual,
    prisma: {
      appointment: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      service: { findUnique: vi.fn(), findMany: vi.fn() },
      staff: { findUnique: vi.fn(), findMany: vi.fn() },
      tenant: { findUnique: vi.fn() },
      businessHours: { findUnique: vi.fn(), findMany: vi.fn() },
      holiday: { findFirst: vi.fn() },
      subscription: { findUnique: vi.fn(), updateMany: vi.fn() },
      customer: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
      $transaction: vi.fn((fn: unknown) => {
        if (typeof fn === "function")
          return fn({
            appointment: { create: vi.fn(), count: vi.fn() },
            subscription: { updateMany: vi.fn() },
            customer: { update: vi.fn() },
          });
        return Promise.all(fn as Promise<unknown>[]);
      }),
    },
  };
});

// Silence console during tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};
