import { type NextRequest } from "next/server";
import { apiSuccess, apiCreated, apiError, handleApiError } from "@/lib/utils/api";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@bookflow/database";
import { createTenantSchema, updateTenantSchema } from "@/lib/validations/tenant";
import { UserRole } from "@bookflow/database";
import slugify from "slugify";

// POST /api/tenants — Create a new tenant (for onboarding)
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await request.json() as unknown;
    const input = createTenantSchema.parse(body);

    // Check if user already has a tenant
    if (ctx.user.tenantId) {
      return apiError("You already have a business account", 400);
    }

    // Ensure unique slug
    let slug = input.slug ?? slugify(input.name, { lower: true, strict: true });
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          timezone: input.timezone,
          currency: input.currency,
          email: input.email ?? undefined,
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country,
          postalCode: input.postalCode,
        },
      });

      // Update user role to OWNER and link to tenant
      await tx.user.update({
        where: { id: ctx.user.id },
        data: {
          tenantId: newTenant.id,
          role: UserRole.OWNER,
        },
      });

      // Create default business hours (Mon-Fri 9am-5pm)
      const defaultHours = [
        "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY",
      ].map((day) => ({
        tenantId: newTenant.id,
        dayOfWeek: day as "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY",
        startTime: "09:00",
        endTime: "17:00",
        isOpen: true,
      }));

      const weekendHours = ["SATURDAY", "SUNDAY"].map((day) => ({
        tenantId: newTenant.id,
        dayOfWeek: day as "SATURDAY" | "SUNDAY",
        startTime: "09:00",
        endTime: "17:00",
        isOpen: false,
      }));

      await tx.businessHours.createMany({
        data: [...defaultHours, ...weekendHours],
      });

      // Create default notification preferences
      await tx.notificationPreference.createMany({
        data: [
          { tenantId: newTenant.id, type: "BOOKING_CONFIRMATION", channel: "EMAIL", enabled: true },
          { tenantId: newTenant.id, type: "BOOKING_REMINDER", channel: "EMAIL", enabled: true, hoursBeforeReminder: 24 },
          { tenantId: newTenant.id, type: "BOOKING_REMINDER", channel: "EMAIL", enabled: true, hoursBeforeReminder: 2 },
          { tenantId: newTenant.id, type: "BOOKING_CANCELLATION", channel: "EMAIL", enabled: true },
          { tenantId: newTenant.id, type: "STAFF_NEW_BOOKING", channel: "EMAIL", enabled: true },
        ],
      });

      return newTenant;
    });

    return apiCreated(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/tenants — Update current tenant settings
export async function PATCH(request: NextRequest) {
  try {
    const { requireTenant, requireRole } = await import("@/lib/permissions");
    const ctx = await requireRole(UserRole.ADMIN);
    const body = await request.json() as unknown;
    const input = updateTenantSchema.parse(body);

    const tenant = await prisma.tenant.update({
      where: { id: ctx.tenant.id },
      data: input,
    });

    return apiSuccess(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/tenants — Get current tenant info
export async function GET(_request: NextRequest) {
  try {
    const { requireTenant } = await import("@/lib/permissions");
    const ctx = await requireTenant();
    return apiSuccess(ctx.tenant);
  } catch (error) {
    return handleApiError(error);
  }
}
