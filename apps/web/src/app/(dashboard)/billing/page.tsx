import { requireTenant } from "@/lib/permissions";
import { prisma } from "@bookflow/database";
import { BillingClient } from "@/components/dashboard/billing/billing-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const ctx = await requireTenant();

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: ctx.tenant.id },
  });

  return (
    <BillingClient
      subscription={subscription}
      tenant={ctx.tenant}
      hasStripeCustomer={!!ctx.tenant.stripeCustomerId}
    />
  );
}
