/**
 * Public endpoint to look up booking by reference.
 * Used by customers to view/manage their own bookings.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/utils/api";
import { prisma } from "@bookflow/database";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { bookingReference: reference, deletedAt: null },
      include: {
        service: { select: { name: true, duration: true, price: true } },
        staff: { select: { name: true, avatarUrl: true } },
        customer: { select: { name: true, email: true } },
        tenant: {
          select: {
            name: true,
            logoUrl: true,
            primaryColor: true,
            phone: true,
            address: true,
            city: true,
            cancellationHours: true,
          },
        },
      },
    });

    if (!appointment) return apiError("Booking not found", 404);

    // Don't expose internal notes or IDs to public
    const { internalNotes: _, ...safeAppointment } = appointment as typeof appointment & { internalNotes?: string | null };
    return apiSuccess(safeAppointment);
  } catch (error) {
    return handleApiError(error);
  }
}
