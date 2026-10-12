import { type NextRequest } from "next/server";
import { apiSuccess, apiCreated, apiError, handleApiError } from "@/lib/utils/api";
import { requireTenant, requireRole, checkSubscriptionFeature } from "@/lib/permissions";
import { prisma, UserRole } from "@bookflow/database";
import { createStaffSchema } from "@/lib/validations/staff";

export async function GET(_request: NextRequest) {
  try {
    const ctx = await requireTenant();

    const staff = await prisma.staff.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      include: {
        services: {
          include: { service: { select: { id: true, name: true } } },
        },
        _count: {
          select: {
            appointments: {
              where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return apiSuccess(staff);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(UserRole.ADMIN);
    const body = (await request.json()) as unknown;
    const input = createStaffSchema.parse(body);

    // Check staff limit based on subscription
    const unlimited = await checkSubscriptionFeature(ctx.tenant.id, "unlimited_staff");
    if (!unlimited) {
      const staffCount = await prisma.staff.count({
        where: { tenantId: ctx.tenant.id, status: "ACTIVE", deletedAt: null },
      });
      // Starter plan: max 1 staff
      if (staffCount >= 1) {
        return apiError("Your plan allows a maximum of 1 staff member. Upgrade to add more.", 403);
      }
    }

    const { serviceIds, ...staffData } = input;

    const staff = await prisma.staff.create({
      data: {
        ...staffData,
        tenantId: ctx.tenant.id,
        services: serviceIds
          ? {
              create: serviceIds.map((serviceId) => ({ serviceId })),
            }
          : undefined,
      },
      include: {
        services: { include: { service: true } },
      },
    });

    return apiCreated(staff);
  } catch (error) {
    return handleApiError(error);
  }
}
