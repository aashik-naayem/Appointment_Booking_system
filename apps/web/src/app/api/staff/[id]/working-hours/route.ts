import { type NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/utils/api";
import { requireTenant } from "@/lib/permissions";
import { prisma } from "@bookflow/database";
import { workingHoursSchema } from "@/lib/validations/staff";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTenant();
    const { id } = await params;

    const hours = await prisma.staffWorkingHours.findMany({
      where: { staffId: id, staff: { tenantId: ctx.tenant.id } },
      orderBy: { dayOfWeek: "asc" },
    });

    return apiSuccess(hours);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTenant();
    const { id } = await params;
    const body = (await request.json()) as unknown;
    const { workingHours } = workingHoursSchema.parse(body);

    // Verify staff belongs to tenant
    const staff = await prisma.staff.findUnique({
      where: { id, tenantId: ctx.tenant.id },
    });
    if (!staff) {
      return new Response(JSON.stringify({ error: "Staff not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Upsert all working hours
    await prisma.$transaction(
      workingHours.map((h) =>
        prisma.staffWorkingHours.upsert({
          where: { staffId_dayOfWeek: { staffId: id, dayOfWeek: h.dayOfWeek } },
          create: { staffId: id, ...h },
          update: { startTime: h.startTime, endTime: h.endTime, isWorking: h.isWorking },
        }),
      ),
    );

    // Enable custom hours on staff
    await prisma.staff.update({
      where: { id },
      data: { hasCustomHours: true },
    });

    const updated = await prisma.staffWorkingHours.findMany({
      where: { staffId: id },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
