import { type NextRequest } from "next/server";
import {
  apiSuccess,
  apiCreated,
  handleApiError,
  parsePaginationParams,
  getPaginationMeta,
} from "@/lib/utils/api";
import { requireTenant, requireRole } from "@/lib/permissions";
import { prisma } from "@bookflow/database";
import { UserRole } from "@bookflow/database";
import { createBookingSchema } from "@/lib/validations/booking";
import { createBooking } from "@/lib/services/appointments";
import { checkBookingRateLimit } from "@/lib/utils/rate-limit";

// GET /api/appointments — List appointments for current tenant
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenant();
    const { searchParams } = request.nextUrl;
    const { page, pageSize } = parsePaginationParams(searchParams);

    const status = searchParams.get("status");
    const staffId = searchParams.get("staffId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {
      tenantId: ctx.tenant.id,
      deletedAt: null,
    };

    if (status) where["status"] = status;
    if (staffId) where["staffId"] = staffId;
    if (dateFrom || dateTo) {
      where["startTime"] = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }
    if (search) {
      where["OR"] = [
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { email: { contains: search, mode: "insensitive" } } },
        { bookingReference: { contains: search, mode: "insensitive" } },
      ];
    }

    // Staff can only see their own appointments
    if (ctx.user.role === UserRole.STAFF && ctx.user.id) {
      const staffMember = await prisma.staff.findFirst({
        where: { userId: ctx.user.id, tenantId: ctx.tenant.id },
      });
      if (staffMember) {
        where["staffId"] = staffMember.id;
      }
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          service: { select: { id: true, name: true, duration: true } },
          staff: { select: { id: true, name: true, avatarUrl: true } },
          customer: { select: { id: true, name: true, email: true, phone: true } },
          payment: { select: { id: true, status: true, amount: true } },
        },
        orderBy: { startTime: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.appointment.count({ where }),
    ]);

    return apiSuccess(appointments, 200, getPaginationMeta(total, page, pageSize));
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/appointments — Create booking (public endpoint with rate limiting)
export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const rateLimit = await checkBookingRateLimit(request);
    if (!rateLimit.success) {
      return new Response(
        JSON.stringify({ error: "Too many booking attempts. Please try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.reset),
          },
        },
      );
    }

    const body = (await request.json()) as unknown;
    const input = createBookingSchema.parse(body);

    // tenantId must come from a verified source (URL param or request body tied to public slug)
    const tenantId = (body as Record<string, unknown>)["tenantId"];
    if (typeof tenantId !== "string") {
      return new Response(JSON.stringify({ error: "Tenant ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const appointment = await createBooking(tenantId, input);
    return apiCreated(appointment);
  } catch (error) {
    return handleApiError(error);
  }
}
