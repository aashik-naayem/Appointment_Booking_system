import { requireTenant } from "@/lib/permissions";
import { prisma } from "@bookflow/database";
import { SettingsClient } from "@/components/dashboard/settings/settings-client";
import { serialize } from "@/lib/utils/serialize";
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
      tenant={serialize(ctx.tenant)}
      businessHours={serialize(businessHours)}
      holidays={serialize(holidays)}
    />
  );
}
