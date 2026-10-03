/**
 * Integration tests for Stripe webhook processing.
 * Tests that subscription state is correctly synced from webhooks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionStatus, SubscriptionPlan } from "@bookflow/database";

// Mock Prisma
const mockSubscription = {
  upsert: vi.fn(),
  updateMany: vi.fn(),
  findFirst: vi.fn(),
};
const mockAuditLog = {
  findFirst: vi.fn(),
  create: vi.fn(),
};
const mockPayment = {
  upsert: vi.fn(),
};

vi.mock("@bookflow/database", async () => {
  const actual = await vi.importActual<typeof import("@bookflow/database")>("@bookflow/database");
  return {
    ...actual,
    prisma: {
      subscription: mockSubscription,
      auditLog: mockAuditLog,
      payment: mockPayment,
    },
  };
});

// Mock STRIPE_PRICE_IDS mapping
vi.mock("@/lib/integrations/stripe", () => ({
  STRIPE_PRICE_IDS: {
    STARTER: { monthly: "price_starter_m", yearly: "price_starter_y" },
    PRO: { monthly: "price_pro_m", yearly: "price_pro_y" },
    BUSINESS: { monthly: "price_biz_m", yearly: "price_biz_y" },
  },
  PLAN_LIMITS: {
    STARTER: { maxStaff: 1, maxBookingsPerMonth: 50 },
    PRO: { maxStaff: null, maxBookingsPerMonth: null },
    BUSINESS: { maxStaff: null, maxBookingsPerMonth: null },
  },
  getPlanFromPriceId: (priceId: string) => {
    const map: Record<string, string> = {
      price_starter_m: "STARTER",
      price_pro_m: "PRO",
      price_biz_m: "BUSINESS",
    };
    return map[priceId] ?? null;
  },
}));

const { processStripeWebhook } = await import("@/lib/integrations/stripe-webhooks");

function makeSubscriptionPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_test123",
    customer: "cus_test123",
    status: "active",
    metadata: { tenantId: "tenant-test" },
    items: {
      data: [{
        price: { id: "price_starter_m", product: "prod_starter" },
        plan: { interval: "month" },
      }],
    },
    current_period_start: Math.floor(Date.now() / 1000) - 100,
    current_period_end: Math.floor(Date.now() / 1000) + 2592000,
    cancel_at_period_end: false,
    trial_start: null,
    trial_end: null,
    canceled_at: null,
    ...overrides,
  };
}

describe("processStripeWebhook – subscription.created", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.findFirst.mockResolvedValue(null); // not yet processed
    mockAuditLog.create.mockResolvedValue({});
    mockSubscription.upsert.mockResolvedValue({});
  });

  it("creates subscription record on subscription.created", async () => {
    await processStripeWebhook(
      "evt_001",
      "customer.subscription.created",
      makeSubscriptionPayload() as Record<string, unknown>,
    );

    expect(mockSubscription.upsert).toHaveBeenCalledOnce();
    const call = mockSubscription.upsert.mock.calls[0]![0];
    expect(call.where.tenantId).toBe("tenant-test");
    expect(call.create.plan).toBe(SubscriptionPlan.STARTER);
    expect(call.create.status).toBe(SubscriptionStatus.ACTIVE);
    expect(call.create.maxStaff).toBe(1);
    expect(call.create.maxBookings).toBe(50);
  });

  it("upgrades plan on subscription.updated to PRO", async () => {
    await processStripeWebhook(
      "evt_002",
      "customer.subscription.updated",
      makeSubscriptionPayload({
        items: {
          data: [{ price: { id: "price_pro_m", product: "prod_pro" }, plan: { interval: "month" } }],
        },
      }) as Record<string, unknown>,
    );

    const call = mockSubscription.upsert.mock.calls[0]![0];
    expect(call.update.plan).toBe(SubscriptionPlan.PRO);
    expect(call.update.maxStaff).toBeNull(); // unlimited
    expect(call.update.maxBookings).toBeNull();
  });

  it("is idempotent — skips already processed events", async () => {
    mockAuditLog.findFirst.mockResolvedValueOnce({ id: "existing-log" });

    await processStripeWebhook(
      "evt_003",
      "customer.subscription.created",
      makeSubscriptionPayload() as Record<string, unknown>,
    );

    expect(mockSubscription.upsert).not.toHaveBeenCalled();
  });

  it("sets TRIALING status for trialing subscription", async () => {
    const trialEnd = Math.floor(Date.now() / 1000) + 1209600; // 14 days
    await processStripeWebhook(
      "evt_004",
      "customer.subscription.created",
      makeSubscriptionPayload({ status: "trialing", trial_end: trialEnd }) as Record<string, unknown>,
    );

    const call = mockSubscription.upsert.mock.calls[0]![0];
    expect(call.create.status).toBe(SubscriptionStatus.TRIALING);
  });
});

describe("processStripeWebhook – subscription.deleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.findFirst.mockResolvedValue(null);
    mockAuditLog.create.mockResolvedValue({});
    mockSubscription.updateMany.mockResolvedValue({ count: 1 });
  });

  it("marks subscription as CANCELED on deletion", async () => {
    await processStripeWebhook(
      "evt_005",
      "customer.subscription.deleted",
      makeSubscriptionPayload({ ended_at: Math.floor(Date.now() / 1000) }) as Record<string, unknown>,
    );

    expect(mockSubscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_test123" },
      data: expect.objectContaining({ status: SubscriptionStatus.CANCELED }),
    });
  });
});

describe("processStripeWebhook – invoice.payment_failed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.findFirst.mockResolvedValue(null);
    mockAuditLog.create.mockResolvedValue({});
    mockSubscription.updateMany.mockResolvedValue({ count: 1 });
  });

  it("sets PAST_DUE status and grace period on payment failure", async () => {
    await processStripeWebhook(
      "evt_006",
      "invoice.payment_failed",
      { subscription: "sub_test123" } as Record<string, unknown>,
    );

    expect(mockSubscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_test123" },
      data: expect.objectContaining({
        status: SubscriptionStatus.PAST_DUE,
        gracePeriodEnd: expect.any(Date),
      }),
    });

    // Grace period should be ~7 days from now
    const call = mockSubscription.updateMany.mock.calls[0]![0];
    const gracePeriod = call.data.gracePeriodEnd as Date;
    const daysUntilGrace = (gracePeriod.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysUntilGrace).toBeGreaterThan(6);
    expect(daysUntilGrace).toBeLessThan(8);
  });
});

describe("processStripeWebhook – invoice.paid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.findFirst.mockResolvedValue(null);
    mockAuditLog.create.mockResolvedValue({});
    mockSubscription.updateMany.mockResolvedValue({ count: 1 });
    mockSubscription.findFirst.mockResolvedValue({ tenantId: "tenant-test" });
    mockPayment.upsert.mockResolvedValue({});
  });

  it("clears grace period and sets ACTIVE on successful payment", async () => {
    await processStripeWebhook(
      "evt_007",
      "invoice.paid",
      {
        subscription: "sub_test123",
        payment_intent: "pi_test123",
        amount_paid: 2900,
        currency: "usd",
        billing_reason: "subscription_cycle",
      } as Record<string, unknown>,
    );

    expect(mockSubscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_test123" },
      data: { status: SubscriptionStatus.ACTIVE, gracePeriodEnd: null },
    });
  });
});
