import { requireTenant } from "@/lib/permissions";
import { prisma } from "@bookflow/database";
import { StaffClient } from "@/components/dashboard/staff/staff-client";
import { serialize } from "@/lib/utils/serialize";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const ctx = await requireTenant();

  const [staff, services] = await Promise.all([
    prisma.staff.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      include: {
        services: { include: { service: { select: { id: true, name: true } } } },
        workingHours: true,
        _count: {
          select: {
            appointments: {
              where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <StaffClient initialStaff={serialize(staff)} services={services} tenantId={ctx.tenant.id} />
  );
}
