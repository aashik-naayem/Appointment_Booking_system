import { requireTenant } from "@/lib/permissions";
import { prisma } from "@bookflow/database";
import { ServicesClient } from "@/components/dashboard/services/services-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const ctx = await requireTenant();

  const [services, categories] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, color: true } },
        staff: {
          include: { staff: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { appointments: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.serviceCategory.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.staff.findMany({
      where: { tenantId: ctx.tenant.id, status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <ServicesClient
      initialServices={services}
      categories={categories}
      tenantId={ctx.tenant.id}
    />
  );
}
