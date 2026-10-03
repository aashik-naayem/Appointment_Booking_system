import { type NextRequest } from "next/server";
import { apiSuccess, apiCreated, handleApiError } from "@/lib/utils/api";
import { requireTenant, requireRole } from "@/lib/permissions";
import { prisma, UserRole } from "@bookflow/database";
import { z } from "zod";

const createHolidaySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurring: z.boolean().default(false),
  isAllDay: z.boolean().default(true),
});

export async function GET() {
  try {
    const ctx = await requireTenant();
    const holidays = await prisma.holiday.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { date: "asc" },
    });
    return apiSuccess(holidays);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole(UserRole.ADMIN);
    const body = await req.json() as unknown;
    const input = createHolidaySchema.parse(body);

    const holiday = await prisma.holiday.create({
      data: {
        tenantId: ctx.tenant.id,
        name: input.name,
        date: new Date(input.date),
        recurring: input.recurring,
        isAllDay: input.isAllDay,
      },
    });

    return apiCreated(holiday);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireRole(UserRole.ADMIN);
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");
    if (!id) return apiSuccess({ deleted: false });

    await prisma.holiday.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
