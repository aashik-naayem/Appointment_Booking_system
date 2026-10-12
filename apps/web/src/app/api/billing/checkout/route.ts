import { type NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/utils/api";
import { requireTenant } from "@/lib/permissions";
import { prisma } from "@bookflow/database";
import {
  createCheckoutSession,
  createStripeCustomer,
  STRIPE_PRICE_IDS,
} from "@/lib/integrations/stripe";
import { z } from "zod";
import { SubscriptionPlan } from "@bookflow/database";

const checkoutSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenant();
    const body = (await request.json()) as unknown;
    const { plan, interval } = checkoutSchema.parse(body);

    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

    // Get or create Stripe customer
    let stripeCustomerId = ctx.tenant.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await createStripeCustomer(ctx.user.email, ctx.tenant.name, {
        tenantId: ctx.tenant.id,
        userId: ctx.user.id,
      });

      await prisma.tenant.update({
        where: { id: ctx.tenant.id },
        data: { stripeCustomerId: customer.id },
      });

      stripeCustomerId = customer.id;
    }

    const priceId = STRIPE_PRICE_IDS[plan][interval];

    const session = await createCheckoutSession({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      stripeCustomerId,
      priceId,
      successUrl: `${appUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/dashboard/billing?cancelled=true`,
    });

    return apiSuccess({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
