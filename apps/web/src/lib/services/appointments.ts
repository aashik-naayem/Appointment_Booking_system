/**
 * Appointment Service
 * All appointment business logic lives here.
 * Route handlers call these functions — never query Prisma directly.
 */

import { prisma, Prisma, AppointmentStatus, PaymentStatus } from "@bookflow/database";
import {
  isSlotAvailable,
  calculateAppointmentEndTime,
  invalidateAvailabilityCache,
} from "./availability";
import { sendNotification } from "./notifications";
import { syncCalendarEvent } from "@/lib/integrations/google-calendar";
import { inngest } from "@/lib/jobs/inngest";
import { checkBookingLimit } from "@/lib/permissions";
import type {
  CreateBookingInput,
  RescheduleBookingInput,
  CancelBookingInput,
} from "@/lib/validations/booking";
import { NotificationType } from "@bookflow/database";

// ============================================================
// CREATE BOOKING
// ============================================================

export async function createBooking(tenantId: string, input: CreateBookingInput) {
  // 1. Check booking limits
  const limitCheck = await checkBookingLimit(tenantId);
  if (!limitCheck.allowed) {
    throw new Error(
      `Booking limit reached. You've used ${limitCheck.current} of ${limitCheck.limit} bookings this month.`,
    );
  }

  // 2. Load service
  const service = await prisma.service.findUnique({
    where: { id: input.serviceId, tenantId, isActive: true, deletedAt: null },
  });

  if (!service) {
    throw new Error("Service not found or unavailable");
  }

  // 3. Validate staff if provided
  if (input.staffId) {
    const staff = await prisma.staff.findUnique({
      where: { id: input.staffId, tenantId, status: "ACTIVE", deletedAt: null },
      include: {
        services: { where: { serviceId: input.serviceId } },
      },
    });

    if (!staff) throw new Error("Staff member not found");
    if (service.requiresStaff && staff.services.length === 0) {
      throw new Error("This staff member cannot perform the selected service");
    }
  }

  const startTime = new Date(input.startTime);
  const endTime = calculateAppointmentEndTime(startTime, service.duration, service.bufferTime);

  // 4. Check availability (authoritative check — not just cached)
  const available = await isSlotAvailable(tenantId, input.serviceId, startTime, input.staffId);
  if (!available) {
    throw new Error("Selected time slot is no longer available");
  }

  // 5. Get/create customer
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  const customer = await findOrCreateCustomer(tenantId, {
    name: input.customerName,
    email: input.customerEmail,
    phone: input.customerPhone,
  });

  // Check if customer is blacklisted
  if (customer.status === "BLACKLISTED") {
    throw new Error("Booking is not available at this time");
  }

  // 6. Calculate pricing
  const depositAmount = tenant.requireDeposit
    ? (service.depositAmount ??
      service.price.toNumber() * (tenant.depositPercentage.toNumber() / 100))
    : 0;

  // 7. Create appointment transactionally.
  // Serializable isolation makes the count-then-insert guard race-safe: if two
  // customers grab the same slot at the same moment, Postgres aborts one of the
  // transactions with P2034 (mapped to a friendly error below).
  const appointment = await prisma
    .$transaction(
      async (tx) => {
        // Double-check availability inside transaction (prevents race conditions)
        const conflictCount = await tx.appointment.count({
          where: {
            tenantId,
            staffId: input.staffId,
            status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        });

        if (conflictCount >= service.maxConcurrent) {
          throw new Error("Time slot was just booked. Please select another time.");
        }

        const apt = await tx.appointment.create({
          data: {
            tenantId,
            serviceId: input.serviceId,
            staffId: input.staffId,
            customerId: customer.id,
            startTime,
            endTime,
            timezone: input.timezone,
            duration: service.duration,
            status: tenant.autoConfirm ? AppointmentStatus.CONFIRMED : AppointmentStatus.PENDING,
            confirmedAt: tenant.autoConfirm ? new Date() : null,
            servicePrice: service.price,
            depositAmount,
            totalAmount: service.price,
            customerNotes: input.customerNotes,
          },
          include: {
            service: { select: { name: true, duration: true } },
            staff: { select: { name: true, email: true } },
            customer: { select: { name: true, email: true, phone: true } },
            tenant: { select: { name: true, timezone: true } },
          },
        });

        // Increment booking counter
        await tx.subscription.updateMany({
          where: { tenantId },
          data: { bookingsThisMonth: { increment: 1 } },
        });

        // Update customer stats
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            totalBookings: { increment: 1 },
            lastVisitAt: startTime,
          },
        });

        return apt;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    .catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new Error("Time slot was just booked. Please select another time.");
      }
      throw error;
    });

  // 8. Post-creation side effects (async - don't block the response)
  void postBookingCreation(appointment, tenantId);

  return appointment;
}

async function postBookingCreation(
  appointment: Awaited<ReturnType<typeof prisma.appointment.create>>,
  tenantId: string,
) {
  try {
    // Invalidate availability cache
    if (appointment.staffId) {
      await invalidateAvailabilityCache(
        tenantId,
        appointment.staffId,
        appointment.startTime,
        appointment.timezone,
      );
    }

    // Schedule notifications via background job
    await inngest.send({
      name: "booking/created",
      data: {
        appointmentId: appointment.id,
        tenantId,
      },
    });
  } catch (error) {
    console.error("Post-booking creation error:", error);
  }
}

// ============================================================
// RESCHEDULE BOOKING
// ============================================================

export async function rescheduleBooking(
  tenantId: string,
  appointmentId: string,
  input: RescheduleBookingInput,
  actorId?: string,
) {
  const existing = await prisma.appointment.findUnique({
    where: { id: appointmentId, tenantId },
    include: { service: true },
  });

  if (!existing) throw new Error("Appointment not found");
  if (existing.status === AppointmentStatus.CANCELLED) {
    throw new Error("Cannot reschedule a cancelled appointment");
  }
  if (existing.status === AppointmentStatus.COMPLETED) {
    throw new Error("Cannot reschedule a completed appointment");
  }

  const newStartTime = new Date(input.startTime);
  const newEndTime = calculateAppointmentEndTime(
    newStartTime,
    existing.service.duration,
    existing.service.bufferTime,
  );

  // Check availability excluding current appointment
  const available = await prisma.appointment.count({
    where: {
      tenantId,
      staffId: input.staffId ?? existing.staffId,
      id: { not: appointmentId },
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      startTime: { lt: newEndTime },
      endTime: { gt: newStartTime },
    },
  });

  if (available >= existing.service.maxConcurrent) {
    throw new Error("Selected time slot is not available");
  }

  // Create new appointment and link to old one
  const [, newAppointment] = await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.RESCHEDULED },
    }),
    prisma.appointment.create({
      data: {
        tenantId,
        serviceId: existing.serviceId,
        staffId: input.staffId ?? existing.staffId,
        customerId: existing.customerId,
        startTime: newStartTime,
        endTime: newEndTime,
        timezone: existing.timezone,
        duration: existing.duration,
        status: AppointmentStatus.CONFIRMED,
        confirmedAt: new Date(),
        servicePrice: existing.servicePrice,
        depositAmount: existing.depositAmount,
        totalAmount: existing.totalAmount,
        customerNotes: existing.customerNotes,
        rescheduledFromId: appointmentId,
      },
    }),
  ]);

  // Trigger notifications
  void inngest.send({
    name: "booking/rescheduled",
    data: {
      appointmentId: newAppointment.id,
      oldAppointmentId: appointmentId,
      tenantId,
    },
  });

  return newAppointment;
}

// ============================================================
// CANCEL BOOKING
// ============================================================

export async function cancelBooking(
  tenantId: string,
  appointmentId: string,
  input: CancelBookingInput,
  actorId?: string,
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId, tenantId },
    include: { tenant: true },
  });

  if (!appointment) throw new Error("Appointment not found");
  if (appointment.status === AppointmentStatus.CANCELLED) {
    throw new Error("Appointment is already cancelled");
  }
  if (appointment.status === AppointmentStatus.COMPLETED) {
    throw new Error("Cannot cancel a completed appointment");
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: actorId,
      cancellationReason: input.reason,
    },
  });

  // Update customer stats
  await prisma.customer.update({
    where: { id: appointment.customerId },
    data: { totalBookings: { decrement: 1 } },
  });

  // Decrement monthly booking count
  await prisma.subscription.updateMany({
    where: { tenantId },
    data: { bookingsThisMonth: { decrement: 1 } },
  });

  // Invalidate cache
  if (appointment.staffId) {
    await invalidateAvailabilityCache(
      tenantId,
      appointment.staffId,
      appointment.startTime,
      appointment.timezone,
    );
  }

  // Trigger notifications
  void inngest.send({
    name: "booking/cancelled",
    data: { appointmentId, tenantId },
  });

  return updated;
}

// ============================================================
// MARK NO-SHOW
// ============================================================

export async function markNoShow(tenantId: string, appointmentId: string) {
  const appointment = await prisma.appointment.update({
    where: { id: appointmentId, tenantId },
    data: {
      status: AppointmentStatus.NO_SHOW,
      noShowAt: new Date(),
    },
  });

  await prisma.customer.update({
    where: { id: appointment.customerId },
    data: { noShowCount: { increment: 1 } },
  });

  return appointment;
}

// ============================================================
// COMPLETE APPOINTMENT
// ============================================================

export async function completeAppointment(tenantId: string, appointmentId: string) {
  const appointment = await prisma.appointment.update({
    where: { id: appointmentId, tenantId },
    data: {
      status: AppointmentStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  // Update customer completed bookings count
  await prisma.customer.update({
    where: { id: appointment.customerId },
    data: {
      completedBookings: { increment: 1 },
      totalSpent: { increment: appointment.totalAmount },
    },
  });

  // Trigger review request job (24h delay)
  void inngest.send({
    name: "booking/completed",
    data: { appointmentId, tenantId },
  });

  return appointment;
}

// ============================================================
// HELPERS
// ============================================================

async function findOrCreateCustomer(
  tenantId: string,
  data: { name: string; email: string; phone?: string },
) {
  const existing = await prisma.customer.findUnique({
    where: { tenantId_email: { tenantId, email: data.email.toLowerCase() } },
  });

  if (existing) {
    // Update name/phone if provided
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        phone: data.phone ?? existing.phone,
      },
    });
  }

  return prisma.customer.create({
    data: {
      tenantId,
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
    },
  });
}
