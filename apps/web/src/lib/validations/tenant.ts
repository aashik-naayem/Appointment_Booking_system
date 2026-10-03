import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2, "URL slug must be at least 2 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "URL slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).optional(),
  timezone: z.string().default("UTC"),
  currency: z.string().length(3).default("USD"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().length(2).default("US"),
  postalCode: z.string().optional(),
});

export const updateTenantSchema = createTenantSchema.partial().omit({ slug: true }).extend({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  bookingLeadTime: z.number().min(0).max(1440).optional(),
  bookingWindowDays: z.number().min(1).max(365).optional(),
  cancellationHours: z.number().min(0).max(168).optional(),
  requireDeposit: z.boolean().optional(),
  depositPercentage: z.number().min(0).max(100).optional(),
  autoConfirm: z.boolean().optional(),
  allowGuestBooking: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
