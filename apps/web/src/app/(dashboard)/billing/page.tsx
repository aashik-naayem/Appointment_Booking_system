import { requireTenant } from "@/lib/permissions";
import { prisma } from "@bookflow/database";
import { BillingClient } from "@/components/dashboard/billing/billing-client";
import { serialize } from "@/lib/utils/serialize";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const ctx = await requireTenant();

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: ctx.tenant.id },
  });

  return (
    <BillingClient
      subscription={serialize(subscription)}
      tenant={serialize(ctx.tenant)}
      hasStripeCustomer={!!ctx.tenant.stripeCustomerId}
    />
  );
}
