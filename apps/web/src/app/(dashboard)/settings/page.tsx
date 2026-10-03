import { requireTenant } from "@/lib/permissions";
import { prisma } from "@bookflow/database";
import { SettingsClient } from "@/components/dashboard/settings/settings-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireTenant();

  const [businessHours, holidays] = await Promise.all([
    prisma.businessHours.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { dayOfWeek: "asc" },
    }),
    prisma.holiday.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { date: "asc" },
    }),
  ]);

  return (
    <SettingsClient
      tenant={ctx.tenant}
      businessHours={businessHours}
      holidays={holidays}
    />
  );
}
