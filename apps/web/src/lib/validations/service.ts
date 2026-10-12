import { z } from "zod";

export const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").max(100),
  description: z.string().max(1000).optional(),
  duration: z
    .number()
    .int()
    .min(5, "Minimum duration is 5 minutes")
    .max(480, "Maximum duration is 8 hours"),
  bufferTime: z.number().int().min(0).max(60).default(0),
  price: z.number().min(0, "Price cannot be negative"),
  depositAmount: z.number().min(0).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  maxConcurrent: z.number().int().min(1).max(20).default(1),
  isActive: z.boolean().default(true),
  requiresStaff: z.boolean().default(true),
  staffIds: z.array(z.string().cuid()).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
