import { requireTenant } from "@/lib/permissions";
import { AppointmentsClient } from "@/components/dashboard/appointments/appointments-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Appointments" };

export default async function AppointmentsPage() {
  const ctx = await requireTenant();
  return <AppointmentsClient tenantId={ctx.tenant.id} timezone={ctx.tenant.timezone} />;
}
