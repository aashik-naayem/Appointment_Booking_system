import { requireTenant } from "@/lib/permissions";
import { AnalyticsClient } from "@/components/dashboard/analytics/analytics-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const ctx = await requireTenant();
  return <AnalyticsClient tenantId={ctx.tenant.id} currency={ctx.tenant.currency} />;
}
