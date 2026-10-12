/**
 * Unit tests for subscription plan limit enforcement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionPlan, SubscriptionStatus } from "@bookflow/database";

// Mock prisma (vi.hoisted: vi.mock factories are hoisted above normal top-level consts)
const mockPrismaSubscription = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@bookflow/database", async () => {
  const actual = await vi.importActual<typeof import("@bookflow/database")>("@bookflow/database");
  return {
    ...actual,
    prisma: {
      subscription: mockPrismaSubscription,
    },
  };
});

// Import after mocking
const { checkBookingLimit, checkSubscriptionFeature } = await import("@/lib/permissions");

describe("checkBookingLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows booking when under limit", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      maxBookings: 50,
      bookingsThisMonth: 30,
    });
    const result = await checkBookingLimit("tenant-1");
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(30);
    expect(result.limit).toBe(50);
  });

  it("blocks booking when limit reached", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      maxBookings: 50,
      bookingsThisMonth: 50,
    });
    const result = await checkBookingLimit("tenant-1");
    expect(result.allowed).toBe(false);
  });

  it("blocks booking when over limit", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      maxBookings: 50,
      bookingsThisMonth: 51,
    });
    const result = await checkBookingLimit("tenant-1");
    expect(result.allowed).toBe(false);
  });

  it("allows unlimited bookings for PRO plan", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      maxBookings: null,
      bookingsThisMonth: 999,
    });
    const result = await checkBookingLimit("tenant-1");
    expect(result.allowed).toBe(true);
    expect(result.limit).toBeNull();
  });

  it("blocks booking when subscription is cancelled", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.CANCELED,
      maxBookings: null,
      bookingsThisMonth: 0,
    });
    const result = await checkBookingLimit("tenant-1");
    expect(result.allowed).toBe(false);
  });

  it("allows booking during trial", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.TRIALING,
      maxBookings: 50,
      bookingsThisMonth: 10,
    });
    const result = await checkBookingLimit("tenant-1");
    expect(result.allowed).toBe(true);
  });

  it("blocks when no subscription found", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce(null);
    const result = await checkBookingLimit("tenant-1");
    expect(result.allowed).toBe(false);
  });
});

describe("checkSubscriptionFeature", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PRO plan has SMS feature", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
    });
    expect(await checkSubscriptionFeature("t1", "sms")).toBe(true);
  });

  it("STARTER plan does NOT have SMS", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
    });
    expect(await checkSubscriptionFeature("t1", "sms")).toBe(false);
  });

  it("BUSINESS plan has API access", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.BUSINESS,
      status: SubscriptionStatus.ACTIVE,
    });
    expect(await checkSubscriptionFeature("t1", "api_access")).toBe(true);
  });

  it("PRO plan does NOT have API access", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
    });
    expect(await checkSubscriptionFeature("t1", "api_access")).toBe(false);
  });

  it("returns false when subscription is past_due", async () => {
    mockPrismaSubscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.PAST_DUE,
    });
    expect(await checkSubscriptionFeature("t1", "sms")).toBe(false);
  });
});
