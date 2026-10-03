/**
 * Stripe Webhook Handler
 * 
 * IMPORTANT: Subscription state is ALWAYS synced from Stripe webhooks.
 * Never trust frontend payment state.
 * All webhook processing is idempotent.
 */

import { prisma, SubscriptionStatus, SubscriptionPlan } from "@bookflow/database";
import { getPlanFromPriceId, PLAN_LIMITS } from "./stripe";
import type Stripe from "stripe";

export async function processStripeWebhook(
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Idempotency check - check audit log for this event
  const existing = await prisma.auditLog.findFirst({
    where: {
      action: "STRIPE_WEBHOOK",
      metadata: { path: ["eventId"], equals: eventId },
    },
  });

  if (existing) {
    console.log(`Stripe event ${eventId} already processed, skipping`);
    return;
  }

  switch (eventType) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(payload as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(payload as Stripe.Subscription);
      break;

    case "invoice.paid":
      await handleInvoicePaid(payload as Stripe.Invoice);
      break;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(payload as Stripe.Invoice);
      break;

    default:
      console.log(`Unhandled Stripe event type: ${eventType}`);
  }

  // Record event as processed
  await prisma.auditLog.create({
    data: {
      action: "STRIPE_WEBHOOK",
      resource: "Subscription",
      description: `Processed Stripe webhook: ${eventType}`,
      metadata: { eventId, eventType },
      severity: "info",
    },
  });
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata["tenantId"];
  if (!tenantId) {
    console.error("No tenantId in subscription metadata:", subscription.id);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? getPlanFromPriceId(priceId) : null;

  if (!plan) {
    console.error("Could not determine plan from price ID:", priceId);
    return;
  }

  const planLimits = PLAN_LIMITS[plan];
  const status = mapStripeStatus(subscription.status);

  await prisma.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripePriceId: priceId!,
      stripeProductId: subscription.items.data[0]?.price.product as string,
      plan,
      status,
      interval: subscription.items.data[0]?.plan.interval ?? "month",
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      maxStaff: planLimits.maxStaff,
      maxBookings: planLimits.maxBookingsPerMonth,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId!,
      plan,
      status,
      interval: subscription.items.data[0]?.plan.interval ?? "month",
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      maxStaff: planLimits.maxStaff,
      maxBookings: planLimits.maxBookingsPerMonth,
      gracePeriodEnd: null,
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: SubscriptionStatus.CANCELED,
      endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : new Date(),
    },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  // Reset grace period on successful payment
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: invoice.subscription as string },
    data: {
      status: SubscriptionStatus.ACTIVE,
      gracePeriodEnd: null,
    },
  });

  // Record payment
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });

  if (sub) {
    await prisma.payment.upsert({
      where: { stripePaymentIntentId: invoice.payment_intent as string ?? `invoice_${invoice.id}` },
      create: {
        tenantId: sub.tenantId,
        stripePaymentIntentId: invoice.payment_intent as string ?? `invoice_${invoice.id}`,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        status: "PAID",
        paidAt: new Date(),
        description: `Subscription payment - ${invoice.billing_reason}`,
      },
      update: {
        status: "PAID",
        paidAt: new Date(),
      },
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  // Set 7-day grace period
  const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: invoice.subscription as string },
    data: {
      status: SubscriptionStatus.PAST_DUE,
      gracePeriodEnd,
    },
  });
}

function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    active: SubscriptionStatus.ACTIVE,
    trialing: SubscriptionStatus.TRIALING,
    past_due: SubscriptionStatus.PAST_DUE,
    canceled: SubscriptionStatus.CANCELED,
    unpaid: SubscriptionStatus.UNPAID,
    paused: SubscriptionStatus.PAUSED,
    incomplete: SubscriptionStatus.INCOMPLETE,
    incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  };

  return statusMap[stripeStatus] ?? SubscriptionStatus.INCOMPLETE;
}
