/**
 * Permission system for BookFlow
 * All permission checks happen on the backend ONLY.
 * Never rely on frontend role checks for security.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@bookflow/database";
import { UserRole, type Tenant, type User } from "@bookflow/database";
import { redirect } from "next/navigation";

// ============================================================
// TYPES
// ============================================================

export type AuthContext = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    tenantId: string | null;
  };
  tenant: Tenant | null;
};

export type RequireAuthOptions = {
  redirectTo?: string;
};

// ============================================================
// CORE AUTH HELPERS
// ============================================================

/**
 * Get authenticated session. Throws if not authenticated.
 * Use in Server Components and Route Handlers.
 */
export async function requireAuth(options?: RequireAuthOptions): Promise<AuthContext> {
  const session = await auth();

  if (!session?.user) {
    redirect(options?.redirectTo ?? "/auth/login");
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      tenantId: session.user.tenantId,
    },
    tenant: null,
  };
}

/**
 * Get authenticated session with tenant. Throws if not authenticated or no tenant.
 */
export async function requireTenant(
  options?: RequireAuthOptions,
): Promise<AuthContext & { tenant: Tenant }> {
  const ctx = await requireAuth(options);

  if (!ctx.user.tenantId) {
    redirect("/onboarding");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.user.tenantId, deletedAt: null },
  });

  if (!tenant) {
    redirect("/onboarding");
  }

  if (!tenant.isActive) {
    redirect("/suspended");
  }

  return { ...ctx, tenant };
}

/**
 * Require a specific role. Redirects if role insufficient.
 */
export async function requireRole(
  requiredRole: UserRole,
  options?: RequireAuthOptions,
): Promise<AuthContext & { tenant: Tenant }> {
  const ctx = await requireTenant(options);

  if (!hasRole(ctx.user.role, requiredRole)) {
    redirect(options?.redirectTo ?? "/dashboard");
  }

  return ctx;
}

/**
 * Require super admin access.
 */
export async function requireSuperAdmin(): Promise<AuthContext> {
  const ctx = await requireAuth();

  if (ctx.user.role !== UserRole.SUPER_ADMIN) {
    redirect("/dashboard");
  }

  return ctx;
}

// ============================================================
// ROLE HIERARCHY
// ============================================================

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.OWNER]: 50,
  [UserRole.ADMIN]: 30,
  [UserRole.STAFF]: 10,
};

/**
 * Check if userRole meets or exceeds requiredRole in hierarchy.
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN;
}

export function isOwner(role: UserRole): boolean {
  return role === UserRole.OWNER || role === UserRole.SUPER_ADMIN;
}

export function isAdmin(role: UserRole): boolean {
  return hasRole(role, UserRole.ADMIN);
}

export function isStaff(role: UserRole): boolean {
  return hasRole(role, UserRole.STAFF);
}

// ============================================================
// TENANT ISOLATION
// ============================================================

/**
 * Verify that a resource belongs to the authenticated user's tenant.
 * Prevents IDOR attacks.
 */
export async function verifyTenantAccess(resourceTenantId: string): Promise<boolean> {
  const ctx = await requireAuth();

  if (ctx.user.role === UserRole.SUPER_ADMIN) return true;
  if (!ctx.user.tenantId) return false;

  return ctx.user.tenantId === resourceTenantId;
}

/**
 * Get the current user's tenantId from the session.
 * Throws if no tenant.
 */
export async function getCurrentTenantId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    throw new TenantAccessError("No tenant found in session");
  }

  return session.user.tenantId;
}

// ============================================================
// TENANT-SCOPED QUERY HELPERS
// ============================================================

/**
 * Returns a where clause that always includes tenantId.
 * Use this to prevent accidental cross-tenant data access.
 */
export function tenantScope(tenantId: string) {
  return { tenantId };
}

/**
 * Verify a specific resource belongs to the tenant.
 * Throws if not found (hides existence from wrong tenant).
 */
export async function requireOwnedResource<T extends { tenantId: string }>(
  resource: T | null,
  tenantId: string,
): Promise<T> {
  if (!resource || resource.tenantId !== tenantId) {
    throw new NotFoundError();
  }
  return resource;
}

// ============================================================
// SUBSCRIPTION PERMISSION CHECKS
// ============================================================

import { SubscriptionPlan } from "@bookflow/database";

export async function checkSubscriptionFeature(
  tenantId: string,
  feature:
    | "sms"
    | "whatsapp"
    | "advanced_analytics"
    | "custom_branding"
    | "api_access"
    | "white_label"
    | "unlimited_staff",
): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { plan: true, status: true },
  });

  if (!subscription) return false;

  const isActive = ["ACTIVE", "TRIALING"].includes(subscription.status);
  if (!isActive) return false;

  const plan = subscription.plan;

  const featureMatrix: Record<typeof feature, SubscriptionPlan[]> = {
    sms: [SubscriptionPlan.PRO, SubscriptionPlan.BUSINESS],
    whatsapp: [SubscriptionPlan.PRO, SubscriptionPlan.BUSINESS],
    advanced_analytics: [SubscriptionPlan.PRO, SubscriptionPlan.BUSINESS],
    custom_branding: [SubscriptionPlan.PRO, SubscriptionPlan.BUSINESS],
    api_access: [SubscriptionPlan.BUSINESS],
    white_label: [SubscriptionPlan.BUSINESS],
    unlimited_staff: [SubscriptionPlan.PRO, SubscriptionPlan.BUSINESS],
  };

  return featureMatrix[feature].includes(plan);
}

export async function checkBookingLimit(tenantId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number | null;
}> {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { plan: true, status: true, maxBookings: true, bookingsThisMonth: true },
  });

  if (!subscription) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const isActive = ["ACTIVE", "TRIALING"].includes(subscription.status);
  if (!isActive) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const limit = subscription.maxBookings;
  const current = subscription.bookingsThisMonth;

  if (limit === null) {
    return { allowed: true, current, limit: null };
  }

  return {
    allowed: current < limit,
    current,
    limit,
  };
}

// ============================================================
// CUSTOM ERRORS
// ============================================================

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export class TenantAccessError extends Error {
  constructor(message = "Tenant access denied") {
    super(message);
    this.name = "TenantAccessError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class SubscriptionError extends Error {
  constructor(message = "Subscription feature not available") {
    super(message);
    this.name = "SubscriptionError";
  }
}
