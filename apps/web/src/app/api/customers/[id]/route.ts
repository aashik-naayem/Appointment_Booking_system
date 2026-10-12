import { type NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  parsePaginationParams,
  getPaginationMeta,
} from "@/lib/utils/api";
import { requireTenant, requireRole } from "@/lib/permissions";
import { prisma, UserRole } from "@bookflow/database";
import { z } from "zod";

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(["ACTIVE", "BLACKLISTED", "VIP"]).optional(),
  blacklistReason: z.string().max(500).optional().nullable(),
  allowMarketing: z.boolean().optional(),
  preferredChannel: z.enum(["EMAIL", "SMS", "WHATSAPP", "IN_APP"]).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTenant();
    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const { page, pageSize } = parsePaginationParams(searchParams);

    const customer = await prisma.customer.findUnique({
      where: { id, tenantId: ctx.tenant.id, deletedAt: null },
    });

    if (!customer) return apiError("Customer not found", 404);

    // Load appointment history separately (paginated)
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where: { customerId: id, tenantId: ctx.tenant.id, deletedAt: null },
        include: {
          service: { select: { name: true, price: true } },
          staff: { select: { name: true } },
          payment: { select: { status: true, amount: true } },
        },
        orderBy: { startTime: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.appointment.count({
        where: { customerId: id, tenantId: ctx.tenant.id, deletedAt: null },
      }),
    ]);

    return apiSuccess({
      customer,
      appointments,
      pagination: getPaginationMeta(total, page, pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRole(UserRole.ADMIN);
    const { id } = await params;
    const body = (await req.json()) as unknown;
    const input = updateCustomerSchema.parse(body);

    const customer = await prisma.customer.update({
      where: { id, tenantId: ctx.tenant.id },
      data: input,
    });

    return apiSuccess(customer);
  } catch (error) {
    return handleApiError(error);
  }
}
