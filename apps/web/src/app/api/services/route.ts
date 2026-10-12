import { type NextRequest } from "next/server";
import { apiSuccess, apiCreated, handleApiError } from "@/lib/utils/api";
import { requireTenant, requireRole } from "@/lib/permissions";
import { prisma, UserRole } from "@bookflow/database";
import { createServiceSchema } from "@/lib/validations/service";

export async function GET(_request: NextRequest) {
  try {
    const ctx = await requireTenant();

    const services = await prisma.service.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, color: true } },
        staff: {
          include: { staff: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { appointments: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return apiSuccess(services);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(UserRole.ADMIN);
    const body = (await request.json()) as unknown;
    const input = createServiceSchema.parse(body);

    const { staffIds, ...serviceData } = input;

    const service = await prisma.service.create({
      data: {
        ...serviceData,
        price: serviceData.price,
        tenantId: ctx.tenant.id,
        staff: staffIds
          ? {
              create: staffIds.map((staffId) => ({ staffId })),
            }
          : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        staff: { include: { staff: { select: { id: true, name: true } } } },
      },
    });

    return apiCreated(service);
  } catch (error) {
    return handleApiError(error);
  }
}
