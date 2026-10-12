import Stripe from "stripe";
import { SubscriptionPlan } from "@bookflow/database";

export const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!, {
  // apiVersion omitted on purpose: the SDK pins the version it was typed against,
  // so it can never drift out of sync with the installed `stripe` package.
  typescript: true,
});

// ============================================================
// PLAN CONFIGURATION
// ============================================================

export const PLAN_LIMITS = {
  [SubscriptionPlan.STARTER]: {
    maxStaff: 1,
    maxBookingsPerMonth: 50,
    features: ["email_reminders", "basic_analytics"],
  },
  [SubscriptionPlan.PRO]: {
    maxStaff: null, // unlimited
    maxBookingsPerMonth: null,
    features: [
      "email_reminders",
      "sms_reminders",
      "whatsapp_reminders",
      "advanced_analytics",
      "custom_branding",
    ],
  },
  [SubscriptionPlan.BUSINESS]: {
    maxStaff: null,
    maxBookingsPerMonth: null,
    features: [
      "email_reminders",
      "sms_reminders",
      "whatsapp_reminders",
      "advanced_analytics",
      "custom_branding",
      "api_access",
      "white_label",
    ],
  },
};

export const STRIPE_PRICE_IDS = {
  [SubscriptionPlan.STARTER]: {
    monthly: process.env["STRIPE_STARTER_MONTHLY_PRICE_ID"]!,
    yearly: process.env["STRIPE_STARTER_YEARLY_PRICE_ID"]!,
  },
  [SubscriptionPlan.PRO]: {
    monthly: process.env["STRIPE_PRO_MONTHLY_PRICE_ID"]!,
    yearly: process.env["STRIPE_PRO_YEARLY_PRICE_ID"]!,
  },
  [SubscriptionPlan.BUSINESS]: {
    monthly: process.env["STRIPE_BUSINESS_MONTHLY_PRICE_ID"]!,
    yearly: process.env["STRIPE_BUSINESS_YEARLY_PRICE_ID"]!,
  },
};

// ============================================================
// STRIPE HELPERS
// ============================================================

export async function createStripeCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>,
) {
  return stripe.customers.create({ email, name, metadata });
}

export async function createCheckoutSession({
  tenantId,
  userId,
  stripeCustomerId,
  priceId,
  successUrl,
  cancelUrl,
}: {
  tenantId: string;
  userId: string;
  stripeCustomerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenantId, userId },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    metadata: { tenantId, userId },
  });
}

export async function createBillingPortalSession(customerId: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function createPaymentIntent({
  amount,
  currency,
  customerId,
  metadata,
}: {
  amount: number; // in cents
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
}) {
  return stripe.paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    metadata,
    automatic_payment_methods: { enabled: true },
  });
}

export function constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, process.env["STRIPE_WEBHOOK_SECRET"]!);
}

export function getPlanFromPriceId(priceId: string): SubscriptionPlan | null {
  for (const [plan, prices] of Object.entries(STRIPE_PRICE_IDS)) {
    if (prices.monthly === priceId || prices.yearly === priceId) {
      return plan as SubscriptionPlan;
    }
  }
  return null;
}
