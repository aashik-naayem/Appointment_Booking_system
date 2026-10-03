import { requireTenant } from "@/lib/permissions";
import { CustomersClient } from "@/components/dashboard/customers/customers-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const ctx = await requireTenant();
  return <CustomersClient tenantId={ctx.tenant.id} />;
}
