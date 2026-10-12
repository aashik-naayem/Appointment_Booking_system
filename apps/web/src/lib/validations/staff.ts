import { z } from "zod";

export const createStaffSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  title: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  commission: z.number().min(0).max(100).default(0),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  serviceIds: z.array(z.string().cuid()).optional(),
});

export const updateStaffSchema = createStaffSchema.partial();

export const workingHoursSchema = z.object({
  workingHours: z.array(
    z.object({
      dayOfWeek: z.enum([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ]),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
      isWorking: z.boolean(),
    }),
  ),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type WorkingHoursInput = z.infer<typeof workingHoursSchema>;
