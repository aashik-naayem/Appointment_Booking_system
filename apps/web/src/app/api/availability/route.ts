import { type NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/utils/api";
import { getAvailableSlots } from "@/lib/services/availability";
import { z } from "zod";

const querySchema = z.object({
  tenantId: z.string().cuid(),
  serviceId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  staffId: z.string().cuid().optional(),
  timezone: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const params = querySchema.parse({
      tenantId: searchParams.get("tenantId"),
      serviceId: searchParams.get("serviceId"),
      date: searchParams.get("date"),
      staffId: searchParams.get("staffId") ?? undefined,
      timezone: searchParams.get("timezone") ?? undefined,
    });

    const slots = await getAvailableSlots(params);
    return apiSuccess(slots);
  } catch (error) {
    return handleApiError(error);
  }
}
