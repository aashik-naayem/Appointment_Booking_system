import { type NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/utils/api";
import { requireTenant, requireRole } from "@/lib/permissions";
import { prisma, UserRole } from "@bookflow/database";
import { updateServiceSchema } from "@/lib/validations/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireTenant();
    const { id } = await params;

    const service = await prisma.service.findUnique({
      where: { id, tenantId: ctx.tenant.id, deletedAt: null },
      include: {
        category: true,
        staff: { include: { staff: { select: { id: true, name: true, avatarUrl: true } } } },
        _count: { select: { appointments: true } },
      },
    });

    if (!service) return apiError("Service not found", 404);
    return apiSuccess(service);
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
    const input = updateServiceSchema.parse(body);

    const { staffIds, ...serviceData } = input;

    const service = await prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id, tenantId: ctx.tenant.id },
        data: serviceData,
      });

      // Update staff assignments if provided
      if (staffIds !== undefined) {
        await tx.staffService.deleteMany({ where: { serviceId: id } });
        if (staffIds.length > 0) {
          await tx.staffService.createMany({
            data: staffIds.map((staffId) => ({ staffId, serviceId: id })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });

    return apiSuccess(service);
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

    // Check for future appointments
    const futureAppointments = await prisma.appointment.count({
      where: {
        serviceId: id,
        tenantId: ctx.tenant.id,
        startTime: { gte: new Date() },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
      },
    });

    if (futureAppointments > 0) {
      return apiError(`Cannot delete: service has ${futureAppointments} upcoming appointment(s)`, 400);
    }

    await prisma.service.update({
      where: { id, tenantId: ctx.tenant.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
