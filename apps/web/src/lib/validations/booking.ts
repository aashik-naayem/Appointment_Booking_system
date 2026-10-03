import { z } from "zod";

export const createBookingSchema = z.object({
  serviceId: z.string().cuid("Invalid service ID"),
  staffId: z.string().cuid("Invalid staff ID").optional(),
  startTime: z.string().datetime("Invalid start time"),
  customerName: z.string().min(1, "Name is required").max(100),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().optional(),
  customerNotes: z.string().max(500).optional(),
  timezone: z.string().default("UTC"),
});

export const rescheduleBookingSchema = z.object({
  startTime: z.string().datetime("Invalid start time"),
  staffId: z.string().cuid().optional(),
  reason: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  internalNotes: z.string().max(1000).optional(),
  staffId: z.string().cuid().optional().nullable(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
