import { type NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/utils/api";
import { requireTenant, requireRole } from "@/lib/permissions";
import { prisma, UserRole } from "@bookflow/database";
import { z } from "zod";

const businessHoursSchema = z.object({
  businessHours: z.array(
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
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      isOpen: z.boolean(),
    }),
  ),
});

export async function GET() {
  try {
    const ctx = await requireTenant();
    const hours = await prisma.businessHours.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { dayOfWeek: "asc" },
    });
    return apiSuccess(hours);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireRole(UserRole.ADMIN);
    const body = (await req.json()) as unknown;
    const { businessHours } = businessHoursSchema.parse(body);

    await prisma.$transaction(
      businessHours.map((h) =>
        prisma.businessHours.upsert({
          where: {
            tenantId_dayOfWeek: { tenantId: ctx.tenant.id, dayOfWeek: h.dayOfWeek },
          },
          create: { tenantId: ctx.tenant.id, ...h },
          update: { startTime: h.startTime, endTime: h.endTime, isOpen: h.isOpen },
        }),
      ),
    );

    const updated = await prisma.businessHours.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { dayOfWeek: "asc" },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
