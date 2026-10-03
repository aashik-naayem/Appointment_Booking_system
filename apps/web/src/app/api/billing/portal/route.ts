import { type NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/utils/api";
import { requireTenant } from "@/lib/permissions";
import { createBillingPortalSession } from "@/lib/integrations/stripe";

export async function POST(_request: NextRequest) {
  try {
    const ctx = await requireTenant();

    if (!ctx.tenant.stripeCustomerId) {
      return apiError("No billing account found", 400);
    }

    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

    const session = await createBillingPortalSession(
      ctx.tenant.stripeCustomerId,
      `${appUrl}/dashboard/billing`,
    );

    return apiSuccess({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
