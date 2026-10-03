import { type NextRequest } from "next/server";
import { apiSuccess, handleApiError, parsePaginationParams, getPaginationMeta } from "@/lib/utils/api";
import { requireTenant } from "@/lib/permissions";
import { prisma } from "@bookflow/database";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenant();
    const { searchParams } = request.nextUrl;
    const { page, pageSize } = parsePaginationParams(searchParams);

    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {
      tenantId: ctx.tenant.id,
      deletedAt: null,
    };

    if (status) where["status"] = status;
    if (search) {
      where["OR"] = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: { select: { appointments: true } },
        },
        orderBy: [{ lastVisitAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return apiSuccess(customers, 200, getPaginationMeta(total, page, pageSize));
  } catch (error) {
    return handleApiError(error);
  }
}
