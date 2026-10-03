import { type NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/utils/api";
import { requireTenant, requireRole } from "@/lib/permissions";
import { prisma, UserRole } from "@bookflow/database";
import { updateStaffSchema } from "@/lib/validations/staff";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireTenant();
    const { id } = await params;

    const staff = await prisma.staff.findUnique({
      where: { id, tenantId: ctx.tenant.id, deletedAt: null },
      include: {
        services: { include: { service: { select: { id: true, name: true, price: true } } } },
        workingHours: { orderBy: { dayOfWeek: "asc" } },
        calendarConnections: {
          select: { id: true, provider: true, calendarName: true, isActive: true, lastSyncAt: true },
        },
        _count: {
          select: {
            appointments: {
              where: {
                status: { notIn: ["CANCELLED", "NO_SHOW"] },
                startTime: { gte: new Date() },
              },
            },
          },
        },
      },
    });

    if (!staff) return apiError("Staff member not found", 404);
    return apiSuccess(staff);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole(UserRole.ADMIN);
    const { id } = await params;
    const body = await req.json() as unknown;
    const input = updateStaffSchema.parse(body);

    const { serviceIds, ...staffData } = input;

    const staff = await prisma.$transaction(async (tx) => {
      const updated = await tx.staff.update({
        where: { id, tenantId: ctx.tenant.id },
        data: staffData,
      });

      if (serviceIds !== undefined) {
        await tx.staffService.deleteMany({ where: { staffId: id } });
        if (serviceIds.length > 0) {
          await tx.staffService.createMany({
            data: serviceIds.map((serviceId) => ({ staffId: id, serviceId })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });

    return apiSuccess(staff);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole(UserRole.ADMIN);
    const { id } = await params;

    const futureAppts = await prisma.appointment.count({
      where: {
        staffId: id,
        tenantId: ctx.tenant.id,
        startTime: { gte: new Date() },
        status: { notIn: ["CANCELLED"] },
      },
    });

    if (futureAppts > 0) {
      return apiError(`Cannot delete: staff has ${futureAppts} upcoming appointment(s)`, 400);
    }

    await prisma.staff.update({
      where: { id, tenantId: ctx.tenant.id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
