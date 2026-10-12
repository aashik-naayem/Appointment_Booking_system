import { type NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/utils/api";
import { requireTenant, requireRole, requireOwnedResource } from "@/lib/permissions";
import { prisma, UserRole } from "@bookflow/database";
import {
  updateAppointmentSchema,
  cancelBookingSchema,
  rescheduleBookingSchema,
} from "@/lib/validations/booking";
import {
  cancelBooking,
  rescheduleBooking,
  completeAppointment,
  markNoShow,
} from "@/lib/services/appointments";

// GET /api/appointments/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTenant();
    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id, tenantId: ctx.tenant.id, deletedAt: null },
      include: {
        service: true,
        staff: { select: { id: true, name: true, email: true, avatarUrl: true } },
        customer: true,
        payment: true,
        notifications: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        rescheduledFrom: { select: { id: true, startTime: true } },
        rescheduledTo: { select: { id: true, startTime: true, status: true } },
      },
    });

    if (!appointment) return apiError("Appointment not found", 404);
    return apiSuccess(appointment);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/appointments/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTenant();
    const { id } = await params;
    const body = (await request.json()) as unknown;

    // Check if this is a reschedule, cancel, complete, or generic update
    const action = (body as Record<string, unknown>)["action"] as string | undefined;

    switch (action) {
      case "cancel": {
        const input = cancelBookingSchema.parse(body);
        const result = await cancelBooking(ctx.tenant.id, id, input, ctx.user.id);
        return apiSuccess(result);
      }

      case "reschedule": {
        const input = rescheduleBookingSchema.parse(body);
        const result = await rescheduleBooking(ctx.tenant.id, id, input, ctx.user.id);
        return apiSuccess(result);
      }

      case "complete": {
        const result = await completeAppointment(ctx.tenant.id, id);
        return apiSuccess(result);
      }

      case "no-show": {
        const result = await markNoShow(ctx.tenant.id, id);
        return apiSuccess(result);
      }

      default: {
        const input = updateAppointmentSchema.parse(body);
        const updated = await prisma.appointment.update({
          where: { id, tenantId: ctx.tenant.id },
          data: input,
        });
        return apiSuccess(updated);
      }
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/appointments/[id] — Soft delete
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole(UserRole.ADMIN);
    const { id } = await params;

    await prisma.appointment.update({
      where: { id, tenantId: ctx.tenant.id },
      data: { deletedAt: new Date() },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
